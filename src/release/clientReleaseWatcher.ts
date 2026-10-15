import { logger } from '../utils/Logger';

/** A short foreground cadence helps pilots discover protocol updates promptly. */
export const CLIENT_RELEASE_POLL_MS = 30_000;
export const UPDATE_ATTEMPT_KEY = 'georoids:client-update-attempt';
const REQUEST_TIMEOUT_MS = 8000;
const FOCUS_THROTTLE_MS = 2000;
const BUILD_RELEASE_PATTERN = /^[a-f0-9]{40}$/iu;

type ReleaseFetch = (input: string, init: RequestInit) => Promise<Response>;
export interface ClientReleaseEnvironment {
  fetch: ReleaseFetch;
  origin: string;
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  isOnline: () => boolean;
  available: (release: string | null) => void;
}

async function readRelease(
  fetch: ReleaseFetch,
  origin: string,
  signal: AbortSignal
): Promise<string> {
  const response = await fetch('/release.json', {
    method: 'GET',
    cache: 'no-store',
    redirect: 'error',
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok || response.redirected) {
    throw new Error(`Invalid release response (status=${response.status})`);
  }
  if (
    new URL(response.url).origin !== origin ||
    response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
  ) {
    throw new Error('Invalid release response origin or content type');
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !('releaseSha' in payload) ||
    typeof payload.releaseSha !== 'string' ||
    !BUILD_RELEASE_PATTERN.test(payload.releaseSha)
  ) {
    throw new Error('Invalid release manifest');
  }
  signal.throwIfAborted();
  return payload.releaseSha.toLowerCase();
}

type ClientReleaseApplication =
  | { kind: 'reloading' }
  | { kind: 'changed'; release: string }
  | { kind: 'current' }
  | { kind: 'unavailable' };

/** Called only after the shell's session/unfinished-input confirmation. */
export async function applyClientRelease(
  expected: string,
  environment: Pick<ClientReleaseEnvironment, 'fetch' | 'origin' | 'isOnline'> & {
    loadedRelease: string;
    reload: () => void;
    storage: Pick<Storage, 'setItem'>;
    signal: AbortSignal;
  }
): Promise<ClientReleaseApplication> {
  if (environment.signal.aborted || !environment.isOnline()) {
    return { kind: 'unavailable' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const published = await readRelease(
      environment.fetch,
      environment.origin,
      AbortSignal.any([controller.signal, environment.signal])
    );
    if (!environment.isOnline()) {
      return { kind: 'unavailable' };
    }
    if (published === environment.loadedRelease.toLowerCase()) {
      return { kind: 'current' };
    }
    if (published !== expected) {
      return { kind: 'changed', release: published };
    }
    environment.storage.setItem(UPDATE_ATTEMPT_KEY, `${environment.loadedRelease}:${published}`);
    environment.reload();
    return { kind: 'reloading' };
  } catch (cause) {
    if (environment.signal.aborted) {
      return { kind: 'unavailable' };
    }
    logger.error(
      'CLIENT_RELEASE',
      'Update check failed; keeping the current client',
      cause instanceof Error ? cause : new Error(String(cause))
    );
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Detection only announces availability; each target release announces once. */
export function watchClientRelease(
  buildRelease: unknown,
  environment: ClientReleaseEnvironment
): () => void {
  if (typeof buildRelease !== 'string' || !BUILD_RELEASE_PATTERN.test(buildRelease)) {
    return () => undefined;
  }
  const build = buildRelease.toLowerCase();
  let stopped = false;
  let failures = 0;
  let pending: AbortController | undefined;
  let candidate: string | undefined;
  let announced: string | null | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestTimeout: ReturnType<typeof setTimeout> | undefined;
  let lastCheck = -Infinity;
  const foreground = () =>
    environment.isOnline() && environment.document.visibilityState === 'visible';

  function schedule() {
    clearTimeout(timer);
    if (!stopped && foreground()) {
      const backoff = Math.min(10, 2 ** Math.max(0, failures - 1));
      timer = setTimeout(
        () => void poll(),
        CLIENT_RELEASE_POLL_MS * backoff * (0.8 + Math.random() * 0.4)
      );
    }
  }

  async function poll() {
    if (stopped || pending || !foreground()) {
      return;
    }
    clearTimeout(timer);
    lastCheck = Date.now();
    const controller = new AbortController();
    pending = controller;
    requestTimeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const published = await readRelease(environment.fetch, environment.origin, controller.signal);
      if (stopped || !foreground()) {
        return;
      }
      failures = 0;
      if (published === build) {
        candidate = undefined;
        if (announced !== null) {
          announced = null;
          environment.available(null);
        }
      } else if (candidate !== published) {
        candidate = published;
      } else if (announced !== published) {
        announced = published;
        environment.available(published);
      }
    } catch (cause) {
      candidate = undefined;
      if (!stopped && foreground()) {
        if (failures === 0) {
          logger.error(
            'CLIENT_RELEASE',
            'Release check failed; keeping the current client',
            cause instanceof Error ? cause : new Error(String(cause))
          );
        }
        failures += 1;
      }
    } finally {
      clearTimeout(requestTimeout);
      if (pending === controller) {
        pending = undefined;
      }
      schedule();
    }
  }

  function onForeground() {
    if (!foreground()) {
      clearTimeout(timer);
      candidate = undefined;
      pending?.abort();
    } else if (
      Date.now() - lastCheck >=
      (failures === 0
        ? FOCUS_THROTTLE_MS
        : CLIENT_RELEASE_POLL_MS * Math.min(10, 2 ** (failures - 1)))
    ) {
      void poll();
    } else {
      schedule();
    }
  }
  const events = ['focus', 'online', 'offline'] as const;
  environment.document.addEventListener('visibilitychange', onForeground);
  for (const event of events) {
    environment.window.addEventListener(event, onForeground);
  }
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(requestTimeout);
    pending?.abort();
    environment.document.removeEventListener('visibilitychange', onForeground);
    for (const event of events) {
      environment.window.removeEventListener(event, onForeground);
    }
  };
}
