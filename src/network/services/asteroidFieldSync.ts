import { containAsteroidPositionInto } from '../../../shared/asteroidMotion';
import { isPoseInAsteroidField } from '../../../shared/boundary';

import type { AsteroidData, AsteroidDestroyEvent } from '../../../shared-types';
import type { Roid } from '../../entities/roid/Roid';

interface AsteroidFieldSyncResult {
  created: AsteroidData[];
  updated: AsteroidData[];
  removed: string[];
}

interface AsteroidFieldSyncScratch extends AsteroidFieldSyncResult {
  snapshotIds: Set<string>;
  localIds: Set<string>;
}

export function createAsteroidFieldSyncScratch(): AsteroidFieldSyncScratch {
  return {
    created: [],
    updated: [],
    removed: [],
    snapshotIds: new Set<string>(),
    localIds: new Set<string>(),
  };
}

/** Classify complete DTO rows against current belt membership, reusing per-session scratch. */
export function partitionAsteroidSnapshot(
  asteroids: readonly AsteroidData[],
  belt: readonly { id: string }[],
  scratch = createAsteroidFieldSyncScratch(),
  complete = false
): AsteroidFieldSyncResult {
  scratch.created.length = 0;
  scratch.updated.length = 0;
  scratch.removed.length = 0;
  scratch.snapshotIds.clear();
  scratch.localIds.clear();
  for (const rock of belt) {
    scratch.localIds.add(rock.id);
  }
  for (const asteroid of asteroids) {
    scratch.snapshotIds.add(asteroid.id);
    if (scratch.localIds.has(asteroid.id)) {
      scratch.updated.push(asteroid);
    } else {
      scratch.localIds.add(asteroid.id);
      scratch.created.push(asteroid);
    }
  }
  if (complete) {
    for (const id of scratch.localIds) {
      if (!scratch.snapshotIds.has(id)) {
        scratch.removed.push(id);
      }
    }
  }
  return scratch;
}

/** Snap only when dead-reckoning has drifted; avoids 30 Hz teleport jitter. */
const ASTEROID_POSE_SNAP_PX = 12;

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
  roid: Roid,
  updates: AsteroidData,
  options: { snapPosition?: boolean } = {}
): void {
  roid.applySnapshotMetadata(updates);
  roid.offsets = [...updates.offsets];
  roid.vertices = updates.vertices;
  roid.jaggedness = updates.jaggedness;
  const localEscaped = !isPoseInAsteroidField(roid.position.x, roid.position.y);
  if (
    options.snapPosition === true ||
    localEscaped ||
    shouldSnapAsteroidPose(roid.position, updates.position)
  ) {
    containAsteroidPositionInto(roid.position, updates.position.x, updates.position.y);
  }
  roid.velocity.x = updates.velocity.x;
  roid.velocity.y = updates.velocity.y;
  roid.r = updates.size;
  roid.angle = updates.rotation;
  roid.angularVelocity = updates.angularVelocity;
  roid.health = updates.health;
  roid.maxHealth = updates.maxHealth;
}

type AsteroidFieldApplyHandlers = {
  readBelt: () => readonly { id: string }[];
  onCreated: (asteroid: AsteroidData) => void;
  onUpdated: (asteroidId: string, updates: AsteroidData) => void;
  onDestroyed: (event: AsteroidDestroyEvent) => void;
  /** Snapshot reconciliation removes stale local rows without destruction VFX. */
  onReconciled: (asteroidId: string) => void;
};

let applyHandlers: AsteroidFieldApplyHandlers | null = null;
const EMPTY_BELT: readonly { id: string }[] = [];

export function readAsteroidBelt(): readonly { id: string }[] {
  return applyHandlers?.readBelt() ?? EMPTY_BELT;
}

export function bindAsteroidFieldApply(handlers: AsteroidFieldApplyHandlers): void {
  applyHandlers = handlers;
}

export function unbindAsteroidFieldApply(): void {
  applyHandlers = null;
}

export function notifyAsteroidDestroyed(event: string | AsteroidDestroyEvent): void {
  applyHandlers?.onDestroyed(typeof event === 'string' ? { asteroidId: event } : event);
}

function notifyAsteroidReconciled(asteroidId: string): void {
  applyHandlers?.onReconciled(asteroidId);
}

/** Fan a partition out to the bound belt handlers. Snapshot removals are reconciliation, not destroys. */
export function applyAsteroidFieldPartition(result: AsteroidFieldSyncResult): void {
  for (const asteroid of result.created) {
    applyHandlers?.onCreated(asteroid);
  }
  for (const asteroid of result.updated) {
    applyHandlers?.onUpdated(asteroid.id, asteroid);
  }
  for (const id of result.removed) {
    notifyAsteroidReconciled(id);
  }
}
