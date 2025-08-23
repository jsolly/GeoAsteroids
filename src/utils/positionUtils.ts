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

  // Ensure the ship's entire radius fits within the boundary
  const safeX = boundary.x + shipRadius;
  const safeY = boundary.y + shipRadius;
  const safeWidth = boundary.width - shipRadius * 2;
  const safeHeight = boundary.height - shipRadius * 2;

  return {
    x: safeX + Math.random() * safeWidth,
    y: safeY + Math.random() * safeHeight,
  };
}
