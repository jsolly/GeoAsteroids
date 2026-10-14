export const CLIENT_ID_STORAGE_KEY = 'georoids.clientId';

function createClientId(): string {
  return `client-${crypto.randomUUID()}`;
}

/** Stable per-tab id so a refresh or reconnect can take over the same ship. */
export function readOrCreateClientId(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): string {
  if (!storage) {
    return createClientId();
  }
  const existing = storage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const created = createClientId();
  storage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}

/** Start mints a new tab identity; the private resume token preserves pilot progress. */
export function replaceStoredClientId(storage?: Pick<Storage, 'setItem'> | null): string {
  const created = createClientId();
  storage?.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}
