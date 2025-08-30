import type { Position } from '../../../shared-types';
import { ROID_SIZE } from '../../constants/entities/roid';
import { getGameBoundary } from '../../physics/boundary';
import { canvasManager } from '../../rendering/canvas';

export function spawnRoidFromEdge(): Position {
  // Get the circular game boundary
  const boundary = getGameBoundary();

  // Generate random angle (0 to 2π)
  const angle = Math.random() * Math.PI * 2;

  // Generate random distance from center, ensuring roid fits within boundary
  // Subtract ROID_SIZE to keep the entire roid within the boundary
  const maxDistance = boundary.radius - ROID_SIZE;
  const distance = Math.random() * maxDistance;

  // Convert polar coordinates to cartesian coordinates
  const x = boundary.cx + distance * Math.cos(angle);
  const y = boundary.cy + distance * Math.sin(angle);

  return { x, y };
}

export function calculateSpawnCount(): number {
  const cvs = canvasManager.getCanvas();
  const width = cvs?.width ?? 800; // Default to 800 for tests and server environments
  return Math.min(6, Math.floor(width / 200));
}
