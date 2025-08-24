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

/**
 * Generates a random position near a specific point, ensuring it's within the game boundary
 * @param center The center point to generate positions near
 * @param maxDistance Maximum distance from the center point
 * @returns A random position near the center point, guaranteed to be inside the boundary
 */
export function getRandomPositionNearPoint(center: Position, maxDistance: number = 200): Position {
  const boundary = getGameBoundary();
  const shipRadius = SHIP_SIZE / 2;

  // Generate a random angle and distance from the center
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * maxDistance;

  // Calculate the new position
  let newX = center.x + distance * Math.cos(angle);
  let newY = center.y + distance * Math.sin(angle);

  // Ensure the position is within the boundary
  const boundaryRadius = boundary.radius - shipRadius;
  const distanceFromCenter = Math.sqrt((newX - boundary.cx) ** 2 + (newY - boundary.cy) ** 2);

  if (distanceFromCenter > boundaryRadius) {
    // If outside boundary, clamp to boundary edge
    const scale = boundaryRadius / distanceFromCenter;
    newX = boundary.cx + (newX - boundary.cx) * scale;
    newY = boundary.cy + (newY - boundary.cy) * scale;
  }

  return { x: newX, y: newY };
}
