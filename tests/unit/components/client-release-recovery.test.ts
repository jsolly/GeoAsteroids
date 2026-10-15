import { afterEach, expect, test, vi } from 'vitest';
import { mountClientRelease, reloadClient } from '../../../src/release/clientReleaseEntry';

const boundary = vi.hoisted(() => ({
  build: 'a'.repeat(40),
  available: (_release: string | null) => {},
  stop: vi.fn(),
}));
vi.mock('../../../src/utils/buildInfo', () => ({ getClientReleaseId: () => boundary.build }));
vi.mock('../../../src/utils/Logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('../../../src/release/clientReleaseWatcher', async () => {
  const actual = await vi.importActual<typeof import('../../../src/release/clientReleaseWatcher')>(
    '../../../src/release/clientReleaseWatcher'
  );
  return {
    ...actual,
    watchClientRelease: (
      _build: string,
      environment: { available: (release: string | null) => void }
    ) => {
      boundary.available = environment.available;
      return boundary.stop;
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  boundary.build = 'a'.repeat(40);
  vi.unstubAllEnvs();
});

test('a stale returned document reports recovery, while the newer document clears its prior attempt marker', () => {
  vi.stubEnv('PROD', true);
  const old = 'a'.repeat(40);
  const next = 'b'.repeat(40);
  sessionStorage.setItem('georoids:client-update-attempt', `${old}:${next}`);
  const announce = vi.fn();
  boundary.build = old;
  const stopOld = mountClientRelease(announce);
  boundary.available(next);
  expect(announce).toHaveBeenLastCalledWith(next, true);
  stopOld();
  boundary.build = next;
  const stopNew = mountClientRelease(announce);
  expect(sessionStorage.getItem('georoids:client-update-attempt')).toBeNull();
  boundary.available('c'.repeat(40));
  expect(announce).toHaveBeenLastCalledWith('c'.repeat(40), false);
  stopNew();
});

test('a throwing native storage getter resolves to a recoverable failed application', async () => {
  const reply = new Response(JSON.stringify({ releaseSha: 'b'.repeat(40) }), {
    headers: { 'content-type': 'application/json' },
  });
  Object.defineProperty(reply, 'url', { value: `${window.location.origin}/release.json` });
  vi.spyOn(window, 'fetch').mockResolvedValue(reply);
  const storage = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
    throw new DOMException('storage blocked', 'SecurityError');
  });
  expect(await reloadClient('b'.repeat(40), new AbortController().signal)).toEqual({
    kind: 'unavailable',
  });
  expect(storage).toHaveBeenCalledTimes(1);
});
