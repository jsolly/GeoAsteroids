/** Backoff after an unexpected gameplay-socket drop. Five tries, then give up. */
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const;

/**
 * Delay before reconnect attempt `attempt` (0-based). `null` means the
 * client should surface the permanent disconnect banner instead of retrying.
 */
export function nextReconnectDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= RECONNECT_DELAYS_MS.length) {
    return null;
  }
  return RECONNECT_DELAYS_MS[attempt];
}
