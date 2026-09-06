import type { Position, Velocity } from '../../shared-types';

// Utility functions to replace Vector operations
export function addVectors(a: Velocity, b: Velocity): Velocity {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function addPositionAndVelocity(pos: Position, vel: Velocity): Position {
  return { x: pos.x + vel.x, y: pos.y + vel.y };
}

export function multiplyVelocity(vel: Velocity, scalar: number): Velocity {
  return { x: vel.x * scalar, y: vel.y * scalar };
}

/** Mutate `vel` by adding `add` — hot-path alternative to addVectors. */
export function addVelocityInPlace(vel: Velocity, add: Velocity): void {
  vel.x += add.x;
  vel.y += add.y;
}

/** Mutate `pos` by adding `vel` — hot-path alternative to addPositionAndVelocity. */
export function addPositionInPlace(pos: Position, vel: Velocity): void {
  pos.x += vel.x;
  pos.y += vel.y;
}

/** Mutate `vel` by a scalar — hot-path alternative to multiplyVelocity. */
export function scaleVelocityInPlace(vel: Velocity, scalar: number): void {
  vel.x *= scalar;
  vel.y *= scalar;
}

/** Cap speed in place. Same formula as the previous alloc-heavy path. */
export function capSpeedInPlace(vel: Velocity, maxSpeed: number): void {
  const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  if (currentSpeed > maxSpeed) {
    const scale = maxSpeed / currentSpeed;
    vel.x *= scale;
    vel.y *= scale;
  }
}

export function getVelocityMagnitude(vel: Velocity): number {
  return Math.sqrt(vel.x ** 2 + vel.y ** 2);
}

export function getDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
}

export function createPositionFromAngle(angle: number, magnitude: number): Position {
  return {
    x: Math.cos(angle) * magnitude,
    y: -Math.sin(angle) * magnitude,
  };
}

export function addPositions(pos1: Position, pos2: Position): Position {
  return { x: pos1.x + pos2.x, y: pos1.y + pos2.y };
}
