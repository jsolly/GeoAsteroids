import type { AsteroidData } from '../../../shared-types';

export interface AsteroidFieldSyncResult {
  created: AsteroidData[];
  updated: AsteroidData[];
}

/**
 * Split an authoritative asteroid snapshot into first-seen creates vs
 * kinematic updates for asteroids the client already spawned.
 */
export function partitionAsteroidSnapshot(
  asteroids: AsteroidData[],
  seenIds: Set<string>
): AsteroidFieldSyncResult {
  const created: AsteroidData[] = [];
  const updated: AsteroidData[] = [];

  for (const asteroid of asteroids) {
    if (seenIds.has(asteroid.id)) {
      updated.push(asteroid);
    } else {
      seenIds.add(asteroid.id);
      created.push(asteroid);
    }
  }

  return { created, updated };
}

/** Pose + health fields that must stay server-authoritative after first create. */
export function asteroidKinematicUpdates(asteroid: AsteroidData): Partial<AsteroidData> {
  return {
    position: asteroid.position,
    velocity: asteroid.velocity,
    rotation: asteroid.rotation,
    angularVelocity: asteroid.angularVelocity,
    health: asteroid.health,
    maxHealth: asteroid.maxHealth,
  };
}

/** Local belt object that can receive an authoritative kinematic snapshot. */
export interface AsteroidKinematicTarget {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  angle: number;
  angularVelocity: number;
  health: number;
  maxHealth: number;
  r: number;
}

/**
 * Write server pose onto a local roid. Used for first create, duplicate
 * create-batch (late join / rejoined seen-id clear), and gameState updates
 * so we never keep a static private copy.
 */
export function applyAsteroidKinematics(
  roid: AsteroidKinematicTarget,
  updates: Partial<AsteroidData>
): void {
  if (updates.position) {
    roid.position = { x: updates.position.x, y: updates.position.y };
  }
  if (updates.velocity) {
    roid.velocity = { x: updates.velocity.x, y: updates.velocity.y };
  }
  if (updates.size !== undefined) {
    roid.r = updates.size;
  }
  if (updates.rotation !== undefined) {
    roid.angle = updates.rotation;
  }
  if (updates.angularVelocity !== undefined) {
    roid.angularVelocity = updates.angularVelocity;
  }
  if (updates.health !== undefined) {
    roid.health = updates.health;
  }
  if (updates.maxHealth !== undefined) {
    roid.maxHealth = updates.maxHealth;
  }
}
