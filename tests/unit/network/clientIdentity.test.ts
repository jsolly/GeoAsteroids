import { expect, test } from 'vitest';
import { CLIENT_ID_STORAGE_KEY, readOrCreateClientId } from '../../../src/network/services/clientIdentity';

test('reuses a stored client id so a tab refresh can rejoin the same ship', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  const first = readOrCreateClientId(storage);
  const second = readOrCreateClientId(storage);

  expect(first).toMatch(/^client-/);
  expect(second).toBe(first);
  expect(store.get(CLIENT_ID_STORAGE_KEY)).toBe(first);
});

test('creates a fresh id when storage is unavailable', () => {
  expect(readOrCreateClientId(null)).toMatch(/^client-/);
});
