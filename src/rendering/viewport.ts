import { getCVS } from '../constants';
import type { Position } from '../entities/player/types';
import { Point } from '../physics/Point';

export function worldToScreen(worldPos: Position, shipPos: Position): Point {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return new Point(worldPos.x - shipPos.x, worldPos.y - shipPos.y);
  }

  return new Point(cvs.width / 2 - shipPos.x + worldPos.x, cvs.height / 2 - shipPos.y + worldPos.y);
}

export function screenToWorld(screenPos: Point, shipPos: Position): Position {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return { x: screenPos.x + shipPos.x, y: screenPos.y + shipPos.y };
  }

  return {
    x: screenPos.x - cvs.width / 2 + shipPos.x,
    y: screenPos.y - cvs.height / 2 + shipPos.y,
  };
}

export function isWorldPositionVisible(
  worldPos: Position,
  shipPos: Position,
  margin: number = 100
): boolean {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to true if canvas is not available
    return true;
  }

  const screenPos = worldToScreen(worldPos, shipPos);
  return (
    screenPos.x >= -margin &&
    screenPos.x <= cvs.width + margin &&
    screenPos.y >= -margin &&
    screenPos.y <= cvs.height + margin
  );
}
