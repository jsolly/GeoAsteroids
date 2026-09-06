import type { Position } from '../../../shared-types';
import { ROID } from '../../constants';
import { getGameBoundary } from '../boundary';
import { Point } from '../Point';

/** Discrete laser radius used by point and swept laser tests. */
export const LASER_HIT_RADIUS = 2;

/**
 * Extra slack when the server validates a client-reported laser↔roid hit.
 * Covers one-way latency while still rejecting far-away phantom reports.
 */
export const LASER_ROID_AUTHORITY_SLOP = 64;

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
  return checkCircularCollision(laserPos, LASER_HIT_RADIUS, asteroidPos, asteroidRadius);
}

/**
 * True when the laser's last step (prev → curr) clips the asteroid.
 * Discrete point tests miss when a fast shot tunnels through a small roid.
 */
export function checkLaserAsteroidCollisionSwept(
  prevLaserPos: Position,
  currLaserPos: Position,
  asteroidPos: Position,
  asteroidRadius: number
): boolean {
  if (checkLaserAsteroidCollision(currLaserPos, asteroidPos, asteroidRadius)) {
    return true;
  }
  if (checkLaserAsteroidCollision(prevLaserPos, asteroidPos, asteroidRadius)) {
    return true;
  }

  const hitRadius = asteroidRadius + LASER_HIT_RADIUS;
  const abx = currLaserPos.x - prevLaserPos.x;
  const aby = currLaserPos.y - prevLaserPos.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq <= 0) {
    return false;
  }

  const apx = asteroidPos.x - prevLaserPos.x;
  const apy = asteroidPos.y - prevLaserPos.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq));
  const closestX = prevLaserPos.x + abx * t;
  const closestY = prevLaserPos.y + aby * t;
  const dx = asteroidPos.x - closestX;
  const dy = asteroidPos.y - closestY;
  return dx * dx + dy * dy < hitRadius * hitRadius;
}

/** True when a reported laser is close enough to the server asteroid to count. */
export function isLaserNearAsteroid(
  laserPos: Position,
  asteroidPos: Position,
  asteroidRadius: number,
  slop: number = LASER_ROID_AUTHORITY_SLOP
): boolean {
  const dx = laserPos.x - asteroidPos.x;
  const dy = laserPos.y - asteroidPos.y;
  const limit = asteroidRadius + LASER_HIT_RADIUS + slop;
  return dx * dx + dy * dy <= limit * limit;
}

/** Server-authoritative score for a destroyed roid. Do not trust client points. */
export function asteroidPointsForRadius(radius: number): number {
  if (radius >= 40) {
    return ROID.POINTS_LARGE;
  }
  if (radius >= 20) {
    return ROID.POINTS_MEDIUM;
  }
  return ROID.POINTS_SMALL;
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
