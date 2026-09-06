import type { Position } from '../../shared-types';

export type PlayfieldSize = { width: number; height: number };
export type PlayfieldRock = { position: Position; r?: number };

/** Ship-centered projection. Scale 1 matches today's 1:1 camera. */
export function projectWorldToScreen(
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1
): { x: number; y: number } {
  return {
    x: canvas.width / 2 + (world.x - ship.x) * scale,
    y: canvas.height / 2 + (world.y - ship.y) * scale,
  };
}

export function isRockOnCanvas(
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1,
  margin = 0
): boolean {
  const screen = projectWorldToScreen(world, ship, canvas, scale);
  return (
    screen.x >= -margin &&
    screen.x <= canvas.width + margin &&
    screen.y >= -margin &&
    screen.y <= canvas.height + margin
  );
}

export function countRocksOnCanvas(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1
): number {
  return roids.filter((roid) => isRockOnCanvas(roid.position, ship, canvas, scale)).length;
}

/**
 * Keep 1:1 while any belt rock is already on the playfield. If the ship-centered
 * window is empty (minimap still has dots), zoom just enough that the farthest
 * rock fits. That is the canvas/minimap mismatch: two cameras, one belt.
 */
export function playfieldZoom(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize
): number {
  if (roids.length === 0) {
    return 1;
  }
  if (countRocksOnCanvas(roids, ship, canvas, 1) > 0) {
    return 1;
  }
  let maxDist = 1;
  for (const roid of roids) {
    const reach = Math.hypot(roid.position.x - ship.x, roid.position.y - ship.y) + (roid.r ?? 0);
    if (reach > maxDist) {
      maxDist = reach;
    }
  }
  const inset = Math.min(canvas.width, canvas.height) / 2 - 24;
  if (inset <= 0) {
    return 1;
  }
  return Math.min(1, inset / maxDist);
}

/** Stroke path for a roid. Empty offsets still paint a circle so radar dots are not holes. */
export function drawingOffsets(offsets: readonly number[]): number[] {
  if (offsets.length > 0) {
    return [...offsets];
  }
  return [1];
}
