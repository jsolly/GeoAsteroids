import type { Position } from '../../shared-types';
import { SHIP_SIZE } from '../constants/entities/ship';
import { getGameBoundary } from '../physics/boundary';

/**
 * Generates a random position within the game boundary, ensuring ships respawn safely
 * @returns A random position that's guaranteed to be inside the boundary
 */
export function getRandomPositionWithinBoundary(): Position {
  const boundary = getGameBoundary();
  const shipRadius = SHIP_SIZE / 2;

  // Generate a random point inside the circle ensuring full ship radius fits
  const maxR = boundary.radius - shipRadius;
  const t = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random()) * maxR; // sqrt for uniform distribution
  return { x: boundary.cx + r * Math.cos(t), y: boundary.cy + r * Math.sin(t) };
}
