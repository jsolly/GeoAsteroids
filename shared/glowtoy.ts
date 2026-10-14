import type { AsteroidData, Position } from '../shared-types';

export const GLOWTOY = {
  maximumActive: 64,
  headlightRange: 420,
  thrusterRange: 140,
  revealRadius: 280,
  attractionRadius: 600,
  cachePoints: 25,
  laserCharge: 0.35,
  tickFrames: 6,
  chargePerTick: 0.018,
  decayPerTick: 0.008,
} as const;

export interface ShipLight {
  position: Position;
  angle: number;
  thrusting: boolean;
  health: number;
  exploding: boolean;
}

/** Matches the forward cone and aft engine light painted on the playfield. */
export function shipIlluminates(light: ShipLight, position: Position): boolean {
  if (light.health <= 0 || light.exploding) {
    return false;
  }
  const dx = position.x - light.position.x;
  const dy = position.y - light.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return true;
  }
  const forward = (dx * Math.cos(light.angle) - dy * Math.sin(light.angle)) / distance;
  return (
    (distance < GLOWTOY.headlightRange && forward > Math.cos(0.42)) ||
    (light.thrusting && distance < GLOWTOY.thrusterRange && forward < -0.5)
  );
}

/** The same visibility threshold applies to the playfield and both navigation maps. */
export function isAsteroidLit(rock: { glowtoy?: AsteroidData['glowtoy'] }): boolean {
  return !rock.glowtoy || rock.glowtoy.charge > 0.015;
}
