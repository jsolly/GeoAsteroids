import type { AsteroidData, WireAsteroidSnapshot } from '../../../shared-types';
import { asteroidHasWireShape } from '../gameStateSnapshot';

export interface AsteroidFieldSyncResult {
  created: AsteroidData[];
  updated: WireAsteroidSnapshot[];
}

/**
 * Split an authoritative asteroid snapshot into first-seen creates vs
 * kinematic updates for asteroids the client already spawned.
 * Lean deltas without shape must not create a private / incomplete roid.
 */
export function partitionAsteroidSnapshot(
  asteroids: WireAsteroidSnapshot[],
  seenIds: Set<string>
): AsteroidFieldSyncResult {
  const created: AsteroidData[] = [];
  const updated: WireAsteroidSnapshot[] = [];

  for (const asteroid of asteroids) {
    if (seenIds.has(asteroid.id)) {
      updated.push(asteroid);
    } else if (asteroidHasWireShape(asteroid)) {
      seenIds.add(asteroid.id);
      created.push(asteroid);
    }
  }

  return { created, updated };
}

/** Pose + health fields that must stay server-authoritative after first create. */
export function asteroidKinematicUpdates(asteroid: WireAsteroidSnapshot): Partial<AsteroidData> {
  const updates: Partial<AsteroidData> = {};
  if (asteroid.position) {
    updates.position = asteroid.position;
  }
  if (asteroid.velocity) {
    updates.velocity = asteroid.velocity;
  }
  if (asteroid.rotation !== undefined) {
    updates.rotation = asteroid.rotation;
  }
  if (asteroid.angularVelocity !== undefined) {
    updates.angularVelocity = asteroid.angularVelocity;
  }
  if (asteroid.health !== undefined) {
    updates.health = asteroid.health;
  }
  if (asteroid.maxHealth !== undefined) {
    updates.maxHealth = asteroid.maxHealth;
  }
  return updates;
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
