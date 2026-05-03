import type { Position } from '../../../shared-types';
import { getGameBoundary } from '../boundary';
import { Point } from '../Point';

/**
 * Check if two circular objects are colliding
 */
export function checkCircularCollision(
  pos1: Position,
  radius1: number,
  pos2: Position,
  radius2: number
): boolean {
  const point1 = new Point(pos1.x, pos1.y);
  const point2 = new Point(pos2.x, pos2.y);
  const distance = point1.distance(point2);
  return distance < radius1 + radius2;
}

/**
 * Check if a ship is outside the game boundary
 */
export function checkBoundaryCollision(shipPos: Position, shipRadius: number): boolean {
  const boundary = getGameBoundary();
  const point = new Point(shipPos.x, shipPos.y);
  const boundaryCenter = new Point(boundary.cx, boundary.cy);
  const distance = point.distance(boundaryCenter);

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
  // Lasers are small, so we use a small collision radius
  const laserRadius = 2;
  return checkCircularCollision(laserPos, laserRadius, asteroidPos, asteroidRadius);
}

/**
 * Check if a laser hits a ship/bot
 */
export function checkLaserShipCollision(
  laserPos: Position,
  shipPos: Position,
  shipRadius: number
): boolean {
  // Lasers are small, so we use a small collision radius
  const laserRadius = 2;
  return checkCircularCollision(laserPos, laserRadius, shipPos, shipRadius);
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
  const isColliding = checkCircularCollision(ship1Pos, ship1Radius, ship2Pos, ship2Radius);

  return isColliding;
}
