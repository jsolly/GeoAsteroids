import type { AsteroidData, AsteroidDestroyEvent, AsteroidTaggedEvent } from '../../../shared-types';
import { containAsteroidPositionInto, isPoseInAsteroidField } from '../../physics/asteroidMotion';

export interface AsteroidFieldSyncResult {
  created: AsteroidData[];
  updated: AsteroidData[];
  removed: string[];
}

export interface AsteroidFieldSyncScratch extends AsteroidFieldSyncResult {
  snapshotIds: Set<string>;
}

export function createAsteroidFieldSyncScratch(): AsteroidFieldSyncScratch {
  return {
    created: [],
    updated: [],
    removed: [],
    snapshotIds: new Set<string>(),
  };
}

/** Mid-session rejoin must keep seen ids so the next snapshot updates in place. */
export function shouldPreserveSeenAsteroidsOnJoin(seenCount: number): boolean {
  return seenCount > 0;
}

/** Enough pose to spawn a visible rock. Lean rows without size must wait. */
export function asteroidHasSpawnPose(
  asteroid: Partial<AsteroidData> & { id?: string }
): asteroid is AsteroidData {
  return (
    asteroid.position !== undefined &&
    Number.isFinite(asteroid.position.x) &&
    Number.isFinite(asteroid.position.y) &&
    typeof asteroid.size === 'number' &&
    Number.isFinite(asteroid.size)
  );
}

/**
 * Split an authoritative asteroid snapshot into first-seen creates vs
 * kinematic updates for asteroids the client already spawned.
 * Incomplete first-seen rows (lean pose-only) do not mark seen — a later
 * full row can still create so the belt is not permanently empty.
 */
export function partitionAsteroidSnapshot(
  asteroids: AsteroidData[],
  seenIds: Set<string>,
  scratch?: AsteroidFieldSyncScratch
): AsteroidFieldSyncResult {
  const created = scratch ? scratch.created : [];
  const updated = scratch ? scratch.updated : [];
  const removed = scratch ? scratch.removed : [];
  if (scratch) {
    created.length = 0;
    updated.length = 0;
    removed.length = 0;
    scratch.snapshotIds.clear();
  }
  const snapshotIds = scratch?.snapshotIds ?? new Set<string>();

  for (const asteroid of asteroids) {
    snapshotIds.add(asteroid.id);
    if (seenIds.has(asteroid.id)) {
      updated.push(asteroid);
    } else if (asteroidHasSpawnPose(asteroid)) {
      seenIds.add(asteroid.id);
      created.push(asteroid);
    }
  }

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

  return scratch ?? { created, updated, removed };
}

/** Pose + health fields that must stay server-authoritative after first create. */
export function asteroidKinematicUpdates(asteroid: Partial<AsteroidData>): Partial<AsteroidData> {
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
  if (asteroid.size !== undefined) {
    updates.size = asteroid.size;
  }
  if (asteroid.isCollabTarget !== undefined) {
    updates.isCollabTarget = asteroid.isCollabTarget;
  }
  return updates;
}

/**
 * Apply a snapshot row to the local belt. A shaped update for a missing id
 * creates instead of no-op — heals seenIds/belt skew from a lean-first race.
 */
export function applyAsteroidRowToBelt(
  findById: (id: string) => AsteroidKinematicTarget | undefined,
  asteroidId: string,
  updates: Partial<AsteroidData>,
  createMissing: (asteroid: AsteroidData) => void
): 'updated' | 'created' | 'skipped' {
  const roid = findById(asteroidId);
  if (roid) {
    applyAsteroidKinematics(roid, updates);
    return 'updated';
  }
  const candidate = { id: asteroidId, ...updates };
  if (asteroidHasSpawnPose(candidate)) {
    createMissing(candidate);
    return 'created';
  }
  return 'skipped';
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
  isCollabTarget?: boolean;
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
 * Velocity / spin always follow the server; position snaps when the
 * interpolated pose has drifted past ASTEROID_POSE_SNAP_PX *or* either
 * pose has escaped the belt (late-join / wrap leftover at 10k), then is
 * contained to the shared field.
 */
export function applyAsteroidKinematics(
  roid: AsteroidKinematicTarget,
  updates: Partial<AsteroidData>,
  options: { snapPosition?: boolean } = {}
): void {
  if (updates.position) {
    const localEscaped = !isPoseInAsteroidField(roid.position.x, roid.position.y);
    if (
      options.snapPosition ||
      localEscaped ||
      shouldSnapAsteroidPose(roid.position, updates.position)
    ) {
      containAsteroidPositionInto(roid.position, updates.position.x, updates.position.y);
    }
  }
  if (updates.velocity) {
    roid.velocity.x = updates.velocity.x;
    roid.velocity.y = updates.velocity.y;
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
  if (updates.isCollabTarget !== undefined) {
    roid.isCollabTarget = updates.isCollabTarget;
  }
}

export type AsteroidFieldApplyHandlers = {
  onCreated: (asteroid: AsteroidData) => void;
  onUpdated: (asteroidId: string, updates: Partial<AsteroidData>) => void;
  onDestroyed: (event: AsteroidDestroyEvent) => void;
  onTagged?: (event: AsteroidTaggedEvent) => void;
};

let applyHandlers: AsteroidFieldApplyHandlers | null = null;

export function bindAsteroidFieldApply(handlers: AsteroidFieldApplyHandlers): void {
  applyHandlers = handlers;
}

export function unbindAsteroidFieldApply(): void {
  applyHandlers = null;
}

export function notifyAsteroidCreated(asteroid: AsteroidData): void {
  applyHandlers?.onCreated(asteroid);
}

export function notifyAsteroidUpdated(asteroidId: string, updates: Partial<AsteroidData>): void {
  applyHandlers?.onUpdated(asteroidId, updates);
}

export function notifyAsteroidDestroyed(event: string | AsteroidDestroyEvent): void {
  applyHandlers?.onDestroyed(typeof event === 'string' ? { asteroidId: event } : event);
}

export function notifyAsteroidTagged(event: AsteroidTaggedEvent): void {
  applyHandlers?.onTagged?.(event);
}

/** Fan a partition out to the bound belt handlers. Full rows keep #469 heal. */
export function applyAsteroidFieldPartition(result: AsteroidFieldSyncResult): void {
  for (const asteroid of result.created) {
    notifyAsteroidCreated(asteroid);
  }
  for (const asteroid of result.updated) {
    notifyAsteroidUpdated(asteroid.id, asteroid);
  }
  for (const id of result.removed) {
    notifyAsteroidDestroyed(id);
  }
}
