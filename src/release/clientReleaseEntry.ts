import { getClientReleaseId } from '../utils/buildInfo';
import { logger } from '../utils/Logger';
import { applyClientRelease, UPDATE_ATTEMPT_KEY, watchClientRelease } from './clientReleaseWatcher';

const ATTEMPT_PATTERN = /^[a-f0-9]{40}:[a-f0-9]{40}$/u;

/** Independent of the match loop; owned by the mounted browser shell. */
export function mountClientRelease(
  available: (release: string | null, stale: boolean) => void
): () => void {
  if (!import.meta.env.PROD) {
    return () => {};
  }
  const release = getClientReleaseId();
  let stale = false;
  try {
    const attempt = window.sessionStorage.getItem(UPDATE_ATTEMPT_KEY);
    stale = attempt !== null && ATTEMPT_PATTERN.test(attempt) && attempt.startsWith(`${release}:`);
    if (attempt !== null && !stale) {
      window.sessionStorage.removeItem(UPDATE_ATTEMPT_KEY);
    }
  } catch (cause) {
    logger.error(
      'CLIENT_RELEASE',
      'Update recovery storage unavailable',
      cause instanceof Error ? cause : new Error(String(cause))
    );
  }
  let stop: () => void = () => {};
  const start = () => {
    stop();
    stop = watchClientRelease(release, {
      fetch: (input, init) => window.fetch(input, init),
      origin: window.location.origin,
      document,
      window,
      isOnline: () => navigator.onLine,
      available: (published) => available(published, stale),
    });
  };
  const hide = () => stop();
  const show = (event: PageTransitionEvent) => {
    if (event.persisted) {
      start();
    }
  };
  start();
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    stop();
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
  };
}

/** Native navigation boundary; callers must obtain explicit reload consent. */
export function reloadClient(expected: string, signal: AbortSignal) {
  return applyClientRelease(expected, {
    fetch: (input, init) => window.fetch(input, init),
    origin: window.location.origin,
    isOnline: () => navigator.onLine,
    loadedRelease: getClientReleaseId(),
    storage: { setItem: (key, value) => window.sessionStorage.setItem(key, value) },
    signal,
    reload: () => window.location.reload(),
  });
}
