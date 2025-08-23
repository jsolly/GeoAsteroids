import type { Position } from '../../../shared-types';
import { SHIP_SIZE } from '../../constants/entities/ship';
import { getGameBoundary } from '../boundary';

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
