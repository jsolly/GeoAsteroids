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
