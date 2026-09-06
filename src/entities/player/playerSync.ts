import type { Position } from '../../../shared-types';
import { SHIP } from '../../constants';
import type { ServerPlayerSnapshot } from './playerTypes';

export function isDeadOrExploding(
  health: number,
  exploding: boolean,
  respawnTimer: number | undefined
): boolean {
  return health <= 0 || exploding || respawnTimer !== undefined;
}

export function shouldAcceptServerTransform(
  isLocal: boolean,
  adoptServerPosition: boolean
): boolean {
  return !isLocal || adoptServerPosition;
}

export function shouldReleaseRespawnLatch(
  isLocal: boolean,
  adoptServerPosition: boolean,
  health: number,
  exploding: boolean,
  respawnTimer: number | undefined,
  position: Position | undefined,
  origin: Position | null,
  minDistance: number = SHIP.RESPAWN_LATCH_MIN_DISTANCE
): boolean {
  if (
    !isLocal ||
    !adoptServerPosition ||
    health <= 0 ||
    exploding ||
    respawnTimer !== undefined ||
    !position
  ) {
    return false;
  }
  if (!origin) {
    return true;
  }
  return Math.hypot(position.x - origin.x, position.y - origin.y) > minDistance;
}

/**
 * Local health merge: accept authoritative damage and respawn heals, but do
 * not let a stale gameState echo rewind client-side regen.
 */
export function resolveLocalHealthFromServer(params: {
  currentHealth: number;
  serverHealth: number;
  maxHealth: number;
  wasDead: boolean;
  wasExploding: boolean;
  lastServerHealthEcho: number | undefined;
}): { health: number; lastServerHealthEcho: number | undefined } {
  const { currentHealth, serverHealth, maxHealth, wasDead, wasExploding, lastServerHealthEcho } =
    params;

  if (!wasDead && !wasExploding) {
    if (serverHealth >= maxHealth) {
      return { health: serverHealth, lastServerHealthEcho: serverHealth };
    }
    if (lastServerHealthEcho === undefined || serverHealth < lastServerHealthEcho) {
      return { health: serverHealth, lastServerHealthEcho: serverHealth };
    }
    return { health: currentHealth, lastServerHealthEcho };
  }

  if ((wasDead || wasExploding) && serverHealth >= maxHealth) {
    return { health: serverHealth, lastServerHealthEcho: serverHealth };
  }

  if (serverHealth > currentHealth) {
    return { health: serverHealth, lastServerHealthEcho: serverHealth };
  }

  return { health: currentHealth, lastServerHealthEcho };
}

export function snapshotHasSpawnProtection(data: ServerPlayerSnapshot): boolean {
  return (data.spawnProtectionTimer ?? 0) > 0;
}
