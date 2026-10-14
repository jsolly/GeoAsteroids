import { getClientReleaseId } from '../utils/buildInfo';
import { watchClientRelease } from './clientReleaseWatcher';

/** Independent of the match loop; owned by the mounted browser shell. */
export function mountClientRelease(): () => void {
  if (!import.meta.env.PROD) {
    return () => {};
  }
  const release = getClientReleaseId();
  let stop: () => void = () => {};
  const start = () => {
    stop();
    stop = watchClientRelease(release, {
      fetch: (input, init) => window.fetch(input, init),
      storage: {
        getItem: (key) => window.sessionStorage.getItem(key),
        setItem: (key, value) => window.sessionStorage.setItem(key, value),
      },
      document,
      reload: () => window.location.reload(),
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
