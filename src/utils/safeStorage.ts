/**
 * Best-effort web storage. When cookies/storage are blocked, localStorage
 * get/set can throw (Firefox, Safari private mode, "block all cookies").
 * Fall back to in-memory values for this tab only so callers never crash.
 */

const memory = new Map<string, string>();
let persistAvailable: boolean | undefined;

function getLocalStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function canPersist(): boolean {
  if (persistAvailable === false) {
    return false;
  }
  const storage = getLocalStorage();
  if (!storage) {
    persistAvailable = false;
    return false;
  }
  if (persistAvailable === true) {
    return true;
  }
  try {
    const probeKey = '__georoids_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    persistAvailable = true;
    return true;
  } catch {
    persistAvailable = false;
    return false;
  }
}

export function getStoredItem(key: string): string | null {
  if (canPersist()) {
    try {
      return getLocalStorage()?.getItem(key) ?? null;
    } catch {
      persistAvailable = false;
    }
  }
  return memory.get(key) ?? null;
}

export function setStoredItem(key: string, value: string): void {
  if (canPersist()) {
    try {
      getLocalStorage()?.setItem(key, value);
      return;
    } catch {
      persistAvailable = false;
    }
  }
  memory.set(key, value);
}

export function removeStoredItem(key: string): void {
  if (canPersist()) {
    try {
      getLocalStorage()?.removeItem(key);
      return;
    } catch {
      persistAvailable = false;
    }
  }
  memory.delete(key);
}

/** Reset probe cache and in-memory fallback (unit tests). */
export function resetSafeStorage(): void {
  memory.clear();
  persistAvailable = undefined;
}
