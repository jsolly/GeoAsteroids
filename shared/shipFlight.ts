import type { Velocity } from '../shared-types';
import { SHIP } from './constants/gameplay';
import { maxVelocityFromMass } from './shipGrowth';

/** Cargo slows an empty-to-full hold linearly, with the same rule on both sides. */
export function cruiseSpeed(
  mass: number,
  kitMaxVelocity: number,
  cargo: number,
  capacity: number
): number {
  const load = Math.max(0, Math.min(1, cargo / Math.max(1, capacity)));
  return ((kitMaxVelocity * maxVelocityFromMass(mass)) / SHIP.MAX_VELOCITY) * (1 - 0.3 * load);
}

export function cruiseVelocity(angle: number, speed: number): Velocity {
  return { x: Math.cos(angle) * speed, y: -Math.sin(angle) * speed };
}
