import { SHIP_SIZE } from '../constants/entities/ship';
import type { Position } from '../entities/player/types';

export interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getGameBoundary(): Boundary {
  // Use a fixed world boundary that's large enough for the game
  // This creates a boundary around the visible game area
  const boundarySize = 2000; // Large enough to contain the game world
  const buffer = 100; // Buffer space before ships are killed

  return {
    x: -boundarySize / 2 - buffer,
    y: -boundarySize / 2 - buffer,
    width: boundarySize + buffer * 2,
    height: boundarySize + buffer * 2,
  };
}

export function isShipOutOfBounds(shipPosition: Position): boolean {
  const boundary = getGameBoundary();
  const shipRadius = SHIP_SIZE / 2;

  // Check if ship center is outside the boundary
  return (
    shipPosition.x - shipRadius < boundary.x ||
    shipPosition.x + shipRadius > boundary.x + boundary.width ||
    shipPosition.y - shipRadius < boundary.y ||
    shipPosition.y + shipRadius > boundary.y + boundary.height
  );
}

export function getBoundaryCollisionSide(
  shipPosition: Position
): 'top' | 'right' | 'bottom' | 'left' | null {
  const boundary = getGameBoundary();
  const shipRadius = SHIP_SIZE / 2;

  if (shipPosition.x - shipRadius < boundary.x) {
    return 'left';
  }
  if (shipPosition.x + shipRadius > boundary.x + boundary.width) {
    return 'right';
  }
  if (shipPosition.y - shipRadius < boundary.y) {
    return 'top';
  }
  if (shipPosition.y + shipRadius > boundary.y + boundary.height) {
    return 'bottom';
  }

  return null;
}
