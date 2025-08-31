import type { Position } from '../../shared-types';
import { ROID } from '../constants';
import { getGameBoundary } from '../physics/boundary';

/**
 * Generates a random position for spawning a roid from the edge of the game boundary.
 * This utility is separated to avoid circular dependencies with EntityFactory.
 */
export function spawnRoidFromEdge(): Position {
  // Get the circular game boundary
  const boundary = getGameBoundary();

  // Generate random angle (0 to 2π)
  const angle = Math.random() * Math.PI * 2;

  // Generate random distance from center, ensuring roid fits within boundary
  // Subtract ROID_SIZE to keep the entire roid within the boundary
  const maxDistance = Math.max(0, boundary.radius - ROID.SIZE); // Clamp to prevent negative
  const distance = Math.random() * maxDistance;

  // Convert polar coordinates to cartesian coordinates
  const x = boundary.cx + distance * Math.cos(angle);
  const y = boundary.cy + distance * Math.sin(angle);

  return { x, y };
}
