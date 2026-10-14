import type { Position } from '../../shared-types';

export type PlayfieldSize = { width: number; height: number };

/** Single close/play scale used by the renderer; the minimap is the wide view. */
export const PLAYFIELD_CLOSE_SCALE = 1;

/** Ship-centered projection. Scale 1 matches today's 1:1 camera. */
export function projectWorldToScreenInto(
  out: { x: number; y: number },
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1
): { x: number; y: number } {
  out.x = world.x - ship.x;
  out.y = world.y - ship.y;
  out.x = canvas.width / 2 + out.x * scale;
  out.y = canvas.height / 2 + out.y * scale;
  return out;
}

const EMPTY_OFFSETS = [1];

/** Keep an asteroid's stroke visible when its snapshot has no radial offsets. */
export function drawingOffsets(offsets: readonly number[]): readonly number[] {
  return offsets.length > 0 ? offsets : EMPTY_OFFSETS;
}
