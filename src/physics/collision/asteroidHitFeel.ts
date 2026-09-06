/**
 * Client-side laser/ship ↔ roid feel after the shared moving field (#436).
 *
 * Server authority for hits stays on the existing client-report path
 * (open #426). This module only makes the local picture crisp: lock a
 * rock so it cannot be re-hit or re-drawn as a ghost, then release if
 * the server never confirms.
 */

export const ASTEROID_PENDING_MS = 800;

export interface PendingAsteroid {
  pendingDestruction: boolean;
  pendingUntilMs: number;
}

export function isAsteroidPending(roid: PendingAsteroid, now: number = Date.now()): boolean {
  if (!roid.pendingDestruction) {
    return false;
  }
  if (roid.pendingUntilMs > 0 && now >= roid.pendingUntilMs) {
    roid.pendingDestruction = false;
    roid.pendingUntilMs = 0;
    return false;
  }
  return true;
}

export function lockAsteroidPending(roid: PendingAsteroid, now: number = Date.now()): void {
  roid.pendingDestruction = true;
  roid.pendingUntilMs = now + ASTEROID_PENDING_MS;
}

/** Remote humans already report their own shots; spectators only play the VFX. */
export function shouldReportLaserAsteroidHit(ownerType: 'local' | 'remote' | 'bot'): boolean {
  return ownerType !== 'remote';
}
