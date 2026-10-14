import { townSquareSpawn } from '../../shared/furnaces';
import type { Position } from '../../shared-types';

/**
 * Shared player spawn. Local and remote ships use this — no factory-specific
 * forks. A fresh flight stands on the town ring.
 */
export function resolveSpawnPosition(explicit?: Position): Position {
  if (explicit) {
    return explicit;
  }
  return townSquareSpawn(Math.random);
}
