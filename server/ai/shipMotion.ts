import { GAME, LASER, SHIP } from '../../src/constants';
import type { Position, Velocity } from '../../shared-types';

/** Same circular arena the rest of the server uses. */
export const ARENA_RADIUS = 3100;
export const CONTAIN_RADIUS = ARENA_RADIUS - 200;
export const STEER_IN_RADIUS = ARENA_RADIUS - 400;

export interface MovableShip {
  position: Position;
  velocity: Velocity;
  angle: number;
  thrusting: boolean;
}

/**
 * One client-frame of shared ship motion (thrust, cap, friction, integrate).
 * Bots use this so they fly the same hull as players — controller only decides
 * angle + thrusting.
 */
export function applyShipMotionFrame(ship: MovableShip): void {
  if (ship.thrusting) {
    ship.velocity.x += (Math.cos(ship.angle) * SHIP.THRUST) / GAME.FPS;
    ship.velocity.y -= (Math.sin(ship.angle) * SHIP.THRUST) / GAME.FPS;
    const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
    if (speed > SHIP.MAX_VELOCITY) {
      const scale = SHIP.MAX_VELOCITY / speed;
      ship.velocity.x *= scale;
      ship.velocity.y *= scale;
    }
  } else {
    const drag = 1 - GAME.FRICTION / GAME.FPS;
    ship.velocity.x *= drag;
    ship.velocity.y *= drag;
  }

  ship.position.x += ship.velocity.x;
  ship.position.y += ship.velocity.y;
}

/** Bot AI ticks at 30 Hz (every 2 client frames). */
export function applyShipMotionSteps(ship: MovableShip, steps: number): void {
  for (let i = 0; i < steps; i++) {
    applyShipMotionFrame(ship);
  }
}

/**
 * Keep a ship inside the play circle. Bounce + face inward so wanderers
 * stay reachable instead of escaping the arena.
 */
export function containShipInArena(ship: MovableShip, containRadius = CONTAIN_RADIUS): void {
  const distFromCenter = Math.hypot(ship.position.x, ship.position.y);
  if (distFromCenter <= containRadius) {
    return;
  }

  const nx = ship.position.x / distFromCenter;
  const ny = ship.position.y / distFromCenter;
  ship.position.x = nx * containRadius;
  ship.position.y = ny * containRadius;

  const vDotN = ship.velocity.x * nx + ship.velocity.y * ny;
  if (vDotN > 0) {
    ship.velocity.x -= 2 * vDotN * nx;
    ship.velocity.y -= 2 * vDotN * ny;
  }

  // Forward vector is (cos a, -sin a); face back toward origin.
  ship.angle = Math.atan2(ny, -nx);
}

export function headingTo(from: Position, to: Position): number {
  return Math.atan2(-(to.y - from.y), to.x - from.x);
}

export function shortestAngleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

export function turnToward(current: number, desired: number, maxTurn: number): number {
  const delta = shortestAngleDelta(current, desired);
  const clamped = Math.max(-maxTurn, Math.min(maxTurn, delta));
  return current + clamped;
}

/** Player turn rate in radians per client frame. */
export function shipTurnPerFrame(): number {
  return ((SHIP.TURN_SPEED * Math.PI) / 180) / GAME.FPS;
}

/** Laser speed in pixels per client frame (same as `generateLaserVelocity`). */
export function laserSpeedPerFrame(): number {
  return LASER.SPEED / GAME.FPS;
}
