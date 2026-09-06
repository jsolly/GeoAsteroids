import { SPAWN } from '../constants';
import { bounceInsideRadius, getAsteroidFieldRadius } from './asteroidMotion';
import { getGameBoundary } from './boundary';

/** Shared play disk: rocks bounce here; ships spawn/respawn/stay here. */
export function getPlayVolumeRadius(): number {
  return getAsteroidFieldRadius();
}

/** Inner disk for ship spawn/respawn so a small camera still sees the belt. */
export function getShipSpawnRadius(): number {
  return Math.min(SPAWN.NEAR_CENTER_RADIUS, getPlayVolumeRadius());
}

export function randomPositionInDisk(
  radius: number,
  rand: () => number = Math.random
): { x: number; y: number } {
  const { cx, cy } = getGameBoundary();
  const angle = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * radius;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function randomShipSpawnPosition(
  rand: () => number = Math.random,
  avoid?: { x: number; y: number },
  minSeparation: number = SPAWN.MIN_RESPAWN_SEPARATION
): { x: number; y: number } {
  const radius = getShipSpawnRadius();
  for (let i = 0; i < 24; i++) {
    const pos = randomPositionInDisk(radius, rand);
    if (!avoid || Math.hypot(pos.x - avoid.x, pos.y - avoid.y) >= minSeparation) {
      return pos;
    }
  }
  return randomPositionInDisk(radius, rand);
}

/**
 * Keep a ship in the asteroid belt so the camera sees the same rocks the
 * minimap draws. Poses past the 3100 kill wall are left alone so a teleport
 * onto the fiery rim still counts as a boundary death.
 */
export function containShipUnlessPastKillWall(
  position: { x: number; y: number },
  velocity: { x: number; y: number }
): { position: { x: number; y: number }; velocity: { x: number; y: number } } {
  const { cx, cy, radius: killRadius } = getGameBoundary();
  const dist = Math.hypot(position.x - cx, position.y - cy);
  if (dist > killRadius) {
    return { position, velocity };
  }
  return bounceInsideRadius(position, velocity, getPlayVolumeRadius());
}
