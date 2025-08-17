import { getCVS } from '../constants';
import { Point } from '../physics/Point';
import { Vector } from '../physics/Vector';

export function worldToScreen(worldPos: Vector, shipPos: Vector): Point {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return new Point(worldPos.x - shipPos.x, worldPos.y - shipPos.y);
  }

  return new Point(cvs.width / 2 - shipPos.x + worldPos.x, cvs.height / 2 - shipPos.y + worldPos.y);
}

export function screenToWorld(screenPos: Point, shipPos: Vector): Vector {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return new Vector(screenPos.x + shipPos.x, screenPos.y + shipPos.y);
  }

  return new Vector(
    screenPos.x - cvs.width / 2 + shipPos.x,
    screenPos.y - cvs.height / 2 + shipPos.y
  );
}

export function isWorldPositionVisible(
  worldPos: Vector,
  shipPos: Vector,
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
