export const CLIENT_ID_STORAGE_KEY = 'georoids.clientId';

/** Stable per-tab id so a refresh or reconnect can take over the same ship. */
export function readOrCreateClientId(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): string {
  const created = `client-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  if (!storage) {
    return created;
  }
  const existing = storage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  storage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}
