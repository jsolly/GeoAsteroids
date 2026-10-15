import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  applyClientRelease,
  CLIENT_RELEASE_POLL_MS,
  type ClientReleaseEnvironment,
  UPDATE_ATTEMPT_KEY,
  watchClientRelease,
} from '../../../src/release/clientReleaseWatcher';
import { logger } from '../../../src/utils/Logger';

vi.mock('../../../src/utils/Logger', () => ({ logger: { error: vi.fn() } }));

const CURRENT = 'a9755405dcfd546ace3e92b4dc8c3ff53d9bb598';
const NEXT = 'b'.repeat(40);
const LATER = 'c'.repeat(40);
const stops: Array<() => void> = [];

function wireResponse(body: string, status = 200, contentType = 'application/json'): Response {
  const reply = new Response(body, { status, headers: { 'content-type': contentType } });
  Object.defineProperty(reply, 'url', {
    value: 'https://georoids.test/release.json',
    configurable: true,
  });
  return reply;
}

function response(release?: string, status = 200): Response {
  return wireResponse(
    JSON.stringify(release != null && release !== '' ? { releaseSha: release } : {}),
    status
  );
}

function fixture() {
  const target = new EventTarget();
  const windowTarget = new EventTarget();
  let online = true;
  const fetch = vi.fn<ClientReleaseEnvironment['fetch']>().mockResolvedValue(response(CURRENT));
  const available = vi.fn();
  const environment: ClientReleaseEnvironment = {
    // Each HTTP request owns a fresh body, even when the controlled payload repeats.
    fetch: async (input, init) => {
      const reply = await fetch(input, init);
      const copy = reply.clone();
      // A redirected response is simulated at this HTTP boundary, not in its body.
      Object.defineProperty(copy, 'redirected', { value: reply.redirected });
      Object.defineProperty(copy, 'url', { value: reply.url });
      return copy;
    },
    available,
    origin: 'https://georoids.test',
    window: {
      addEventListener: windowTarget.addEventListener.bind(windowTarget),
      removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
    },
    isOnline: () => online,
    document: {
      visibilityState: 'visible',
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
  };
  return { fetch, available, environment, target, windowTarget, offline: () => (online = false) };
}

async function start(f: ReturnType<typeof fixture>, build = CURRENT) {
  const stop = watchClientRelease(build, f.environment);
  stops.push(stop);
  await vi.advanceTimersByTimeAsync(0);
  // Subsequent assertions observe changes after the initial state reconciliation.
  f.available.mockClear();
  return stop;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.clearAllMocks();
});
afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('open clients announce only for a verified published client release', () => {
  test('a restarted watcher reconciles a retained notice when publication returns to the loaded build', async () => {
    const f = fixture();
    f.fetch.mockResolvedValue(response(NEXT));
    const stop = await start(f);
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).toHaveBeenLastCalledWith(NEXT);
    stop();

    f.fetch.mockResolvedValue(response(CURRENT));
    stops.push(watchClientRelease(CURRENT, f.environment));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.available).toHaveBeenLastCalledWith(null);
    const calls = f.available.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 3);
    expect(f.available).toHaveBeenCalledTimes(calls);
  });

  test('a current baseline then two matching changed manifests announces exactly once across later polls', async () => {
    const f = fixture();
    await start(f);
    expect(f.available).not.toHaveBeenCalled();
    expect(f.fetch).toHaveBeenCalledWith(
      '/release.json',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        credentials: 'same-origin',
      })
    );
    f.fetch.mockResolvedValue(response(NEXT));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).toHaveBeenCalledTimes(1);
    const polls = f.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 4);
    f.target.dispatchEvent(new Event('visibilitychange'));
    expect(f.fetch.mock.calls.length).toBeGreaterThan(polls);
    expect(f.available).toHaveBeenCalledTimes(1);
  });

  test('full published SHAs matching the full build remain current', async () => {
    const f = fixture();
    await start(f, CURRENT.toUpperCase());
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 3);
    expect(f.available).not.toHaveBeenCalled();
  });

  test('missing, unknown, abbreviated, failed and offline responses never confirm a change', async () => {
    const f = fixture();
    await start(f);
    const redirected = response(NEXT);
    Object.defineProperty(redirected, 'redirected', { value: true });
    for (const invalid of [
      redirected,
      response(),
      response('unknown'),
      response('dev'),
      response(NEXT.slice(0, 7)),
      response(NEXT, 503),
      wireResponse('<html>fallback</html>', 200, 'text/html'),
      wireResponse('{broken'),
      wireResponse('null'),
      wireResponse('[]'),
      wireResponse(JSON.stringify({ releaseSha: 42 })),
    ]) {
      f.fetch.mockResolvedValue(response(NEXT));
      await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
      f.fetch.mockResolvedValue(invalid);
      await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    }
    f.fetch.mockResolvedValue(response(NEXT));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    f.fetch.mockRejectedValue(new Error('offline'));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    f.fetch.mockResolvedValue(response(NEXT));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).not.toHaveBeenCalled();
  });

  test('a stale initial bundle announces availability without depending on tab storage', async () => {
    const f = fixture();
    f.fetch.mockResolvedValue(response(NEXT));
    await start(f);
    expect(f.available).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).toHaveBeenCalledTimes(1);
  });

  test('visible resume polls promptly, overlapping requests coalesce, and cleanup aborts and detaches the watcher', async () => {
    const f = fixture();
    const stop = await start(f);
    Object.defineProperty(f.environment.document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    f.target.dispatchEvent(new Event('visibilitychange'));
    expect(f.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    Object.defineProperty(f.environment.document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    let resolve!: (value: Response) => void;
    f.fetch.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    );
    f.target.dispatchEvent(new Event('visibilitychange'));
    f.target.dispatchEvent(new Event('visibilitychange'));
    expect(f.fetch).toHaveBeenCalledTimes(2);
    const request = f.fetch.mock.calls[1]?.[1];
    stop();
    expect(request?.signal?.aborted).toBe(true);
    resolve(response(NEXT));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 2);
    f.target.dispatchEvent(new Event('visibilitychange'));
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.available).not.toHaveBeenCalled();
  });

  test('unknown builds do not check for updates', async () => {
    const f = fixture();
    await start(f, 'unknown');
    expect(f.fetch).not.toHaveBeenCalled();
  });
});

test('an offline release check keeps the loaded client and logs one error during the outage', async () => {
  const f = fixture();
  const cause = new Error('offline');
  const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  f.fetch.mockRejectedValue(cause);
  await start(f);
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 3);
  expect(f.available).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledExactlyOnceWith(
    'CLIENT_RELEASE',
    'Release check failed; keeping the current client',
    cause
  );
});

test('an invalid release response logs once until a valid response restores the check', async () => {
  const f = fixture();
  await start(f);
  f.fetch.mockResolvedValue(response(NEXT, 503));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(logger.error).toHaveBeenCalledExactlyOnceWith(
    'CLIENT_RELEASE',
    'Release check failed; keeping the current client',
    expect.objectContaining({ message: 'Invalid release response (status=503)' })
  );

  f.fetch.mockResolvedValue(response(CURRENT));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 2);
  f.fetch.mockResolvedValue(response(NEXT, 503));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(logger.error).toHaveBeenCalledTimes(2);
});

test('distinct full releases sharing a seven-character prefix still announce', async () => {
  const f = fixture();
  f.fetch.mockResolvedValue(response(`${CURRENT.slice(0, 7)}${'b'.repeat(33)}`));
  await start(f);
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(f.available).toHaveBeenCalledTimes(1);
});

test('abbreviated build identities cannot announce an update', async () => {
  const f = fixture();
  await start(f, CURRENT.slice(0, 7));
  expect(f.fetch).not.toHaveBeenCalled();
});

test('changing published candidates need two consecutive matching observations', async () => {
  const f = fixture();
  await start(f);
  for (const published of [NEXT, LATER, NEXT]) {
    f.fetch.mockResolvedValue(response(published));
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
    expect(f.available).not.toHaveBeenCalled();
  }
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(f.available).toHaveBeenCalledTimes(1);
});

test('a late response after timeout resets change confirmation', async () => {
  const f = fixture();
  await start(f);
  f.fetch.mockResolvedValue(response(NEXT));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  let deliver: ((reply: Response) => void) | undefined;
  f.fetch.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        deliver = resolve;
      })
  );
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  await vi.advanceTimersByTimeAsync(8000);
  expect(f.fetch.mock.calls.at(-1)?.[1].signal?.aborted).toBe(true);
  if (!deliver) {
    throw new Error('No in-flight release request');
  }
  deliver(response(NEXT));
  await vi.advanceTimersByTimeAsync(0);
  f.fetch.mockResolvedValue(response(NEXT));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(f.available).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS);
  expect(f.available).toHaveBeenCalledTimes(1);
});

test('offline and hidden tabs skip checks; connected focus checks and cleanup removes listeners', async () => {
  const f = fixture();
  const stop = await start(f);
  await vi.advanceTimersByTimeAsync(2000);
  f.windowTarget.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(0);
  expect(f.fetch).toHaveBeenCalledTimes(2);
  f.offline();
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 2);
  f.windowTarget.dispatchEvent(new Event('online'));
  expect(f.fetch).toHaveBeenCalledTimes(2);
  stop();
  f.windowTarget.dispatchEvent(new Event('focus'));
  expect(f.fetch).toHaveBeenCalledTimes(2);
});

test('each tab independently announces an update and never controls another tab', async () => {
  const first = fixture();
  const second = fixture();
  await start(first);
  await start(second);
  first.fetch.mockResolvedValue(response(NEXT));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 2);
  expect(first.available).toHaveBeenCalledTimes(1);
  expect(second.available).not.toHaveBeenCalled();
});

test('a later distinct release announces again while repeated target checks stay quiet', async () => {
  const f = fixture();
  await start(f);
  f.fetch.mockResolvedValue(response(NEXT));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 3);
  expect(f.available).toHaveBeenCalledExactlyOnceWith(NEXT);
  f.fetch.mockResolvedValue(response(LATER));
  await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 2);
  expect(f.available).toHaveBeenLastCalledWith(LATER);
  expect(f.available).toHaveBeenCalledTimes(2);
});

test('focus storms coalesce, and hidden/offline transitions remove foreground timers', async () => {
  const f = fixture();
  await start(f);
  for (let i = 0; i < 20; i += 1) {
    f.windowTarget.dispatchEvent(new Event('focus'));
  }
  expect(f.fetch).toHaveBeenCalledTimes(1);
  Object.defineProperty(f.environment.document, 'visibilityState', {
    value: 'hidden',
    configurable: true,
  });
  f.target.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
});

test('wrong content type and foreign response URL cannot announce availability', async () => {
  const f = fixture();
  await start(f);
  const wrongType = response(NEXT);
  wrongType.headers.set('content-type', 'text/html');
  const foreign = new Response(JSON.stringify({ releaseSha: NEXT }), {
    headers: { 'content-type': 'application/json' },
  });
  Object.defineProperty(foreign, 'url', { value: 'https://foreign.test/release.json' });
  for (const reply of [wrongType, foreign]) {
    f.fetch.mockResolvedValue(reply);
    await vi.advanceTimersByTimeAsync(CLIENT_RELEASE_POLL_MS * 3);
  }
  expect(f.available).not.toHaveBeenCalled();
});

test('consented application revalidates the target and fails safely offline, on drift, or blocked recovery storage', async () => {
  const f = fixture();
  const values = new Map<string, string>();
  const reload = vi.fn();
  const environment = {
    fetch: f.environment.fetch,
    origin: f.environment.origin,
    isOnline: f.environment.isOnline,
    loadedRelease: CURRENT,
    reload,
    signal: new AbortController().signal,
    storage: {
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  };
  expect(await applyClientRelease(NEXT, environment)).toEqual({ kind: 'current' });
  f.fetch.mockResolvedValue(response(LATER));
  expect(await applyClientRelease(NEXT, environment)).toEqual({ kind: 'changed', release: LATER });
  expect(reload).not.toHaveBeenCalled();
  f.fetch.mockResolvedValue(response(NEXT));
  const set = vi.spyOn(environment.storage, 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  expect(await applyClientRelease(NEXT, environment)).toEqual({ kind: 'unavailable' });
  expect(reload).not.toHaveBeenCalled();
  set.mockRestore();
  expect(await applyClientRelease(NEXT, environment)).toEqual({ kind: 'reloading' });
  expect(values.get(UPDATE_ATTEMPT_KEY)).toBe(`${CURRENT}:${NEXT}`);
  expect(reload).toHaveBeenCalledTimes(1);
  f.offline();
  expect(await applyClientRelease(NEXT, environment)).toEqual({ kind: 'unavailable' });
  expect(reload).toHaveBeenCalledTimes(1);
});
