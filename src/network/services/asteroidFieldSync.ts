import type { AsteroidData, WireAsteroidSnapshot } from '../../../shared-types';
import { containAsteroidPosition } from '../../physics/asteroidMotion';
import { asteroidHasWireShape } from '../gameStateSnapshot';

export interface AsteroidFieldSyncResult {
  created: AsteroidData[];
  updated: WireAsteroidSnapshot[];
  removed: string[];
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
  const snapshotIds = new Set<string>();

  for (const asteroid of asteroids) {
    snapshotIds.add(asteroid.id);
    if (seenIds.has(asteroid.id)) {
      updated.push(asteroid);
    } else if (asteroidHasWireShape(asteroid)) {
      seenIds.add(asteroid.id);
      created.push(asteroid);
    }
  }

  const removed: string[] = [];
  // An empty snapshot is not a wipe — last-player reset + a dropped packet
  // must not clear the remaining tab's local belt.
  if (asteroids.length > 0) {
    for (const id of seenIds) {
      if (!snapshotIds.has(id)) {
        removed.push(id);
      }
    }
    for (const id of removed) {
      seenIds.delete(id);
    }
  }

  return { created, updated, removed };
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

/** Snap only when dead-reckoning has drifted; avoids 30 Hz teleport jitter. */
export const ASTEROID_POSE_SNAP_PX = 12;

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

export function shouldSnapAsteroidPose(
  local: { x: number; y: number },
  server: { x: number; y: number },
  snapPx: number = ASTEROID_POSE_SNAP_PX
): boolean {
  return Math.hypot(server.x - local.x, server.y - local.y) > snapPx;
}

/**
 * Write server kinematics onto a local roid.
 * Velocity / spin always follow the server; position snaps only when the
 * interpolated pose has drifted past ASTEROID_POSE_SNAP_PX, then is
 * contained to the shared belt (#444).
 */
export function applyAsteroidKinematics(
  roid: AsteroidKinematicTarget,
  updates: Partial<AsteroidData>,
  options: { snapPosition?: boolean } = {}
): void {
  if (updates.position) {
    if (options.snapPosition || shouldSnapAsteroidPose(roid.position, updates.position)) {
      roid.position = containAsteroidPosition(updates.position.x, updates.position.y);
    }
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
