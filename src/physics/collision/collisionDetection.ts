import type { Position } from '../../../shared-types';
import { LASER } from '../../constants';
import { getGameBoundary } from '../boundary';
import { flooredDistance } from '../Point';

/**
 * Check if two circular objects are colliding.
 * Uses the same floored Euclidean distance as Point.distance — no Point alloc.
 */
export function checkCircularCollision(
  pos1: Position,
  radius1: number,
  pos2: Position,
  radius2: number
): boolean {
  return flooredDistance(pos1.x, pos1.y, pos2.x, pos2.y) < radius1 + radius2;
}

/**
 * Check if a ship is outside the game boundary
 */
export function checkBoundaryCollision(shipPos: Position, shipRadius: number): boolean {
  const boundary = getGameBoundary();
  const distance = flooredDistance(shipPos.x, shipPos.y, boundary.cx, boundary.cy);

  // Ship is outside boundary if its edge is beyond the boundary radius
  return distance + shipRadius > boundary.radius;
}

/**
 * Check if a laser hits an asteroid
 */
export function checkLaserAsteroidCollision(
  laserPos: Position,
  asteroidPos: Position,
  asteroidRadius: number
): boolean {
  return checkCircularCollision(laserPos, LASER.COLLISION_RADIUS, asteroidPos, asteroidRadius);
}

/**
 * Check if a laser hits a ship/bot
 */
export function checkLaserShipCollision(
  laserPos: Position,
  shipPos: Position,
  shipRadius: number
): boolean {
  return checkCircularCollision(laserPos, LASER.COLLISION_RADIUS, shipPos, shipRadius);
}

/**
 * Check if two ships are colliding
 */
export function checkShipCollision(
  ship1Pos: Position,
  ship1Radius: number,
  ship2Pos: Position,
  ship2Radius: number
): boolean {
  return checkCircularCollision(ship1Pos, ship1Radius, ship2Pos, ship2Radius);
}
