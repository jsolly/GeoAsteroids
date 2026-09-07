import type { Position } from '../../shared-types';
import { containAsteroidPositionInto } from '../physics/asteroidMotion';

export type PlayfieldSize = { width: number; height: number };
export type PlayfieldRock = {
  position: Position;
  r?: number;
  angle?: number;
  pendingDestruction?: boolean;
};

const projectScratch = { x: 0, y: 0 };
const centroidScratch = { x: 0, y: 0 };
const containScratch = { x: 0, y: 0 };

/** Floor: stay 1:1 only when at least this many drawable rocks sit inside the inset. */
export const PLAYFIELD_MIN_VISIBLE = 2;
/** Stay 1:1 only when at least this share of the belt is on the playfield. */
export const PLAYFIELD_MIN_FRACTION = 0.25;
/** Pixels inside the canvas edge a rock center must be to count as "on the playfield". */
export const PLAYFIELD_COMFORT_INSET = 48;

/** How many comfortable rocks are required before 1:1 is allowed. */
export function playfieldMinVisible(beltCount: number): number {
  return Math.max(PLAYFIELD_MIN_VISIBLE, Math.ceil(beltCount * PLAYFIELD_MIN_FRACTION));
}

/** Ship-centered projection. Scale 1 matches today's 1:1 camera. */
export function projectWorldToScreenInto(
  out: { x: number; y: number },
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1
): { x: number; y: number } {
  out.x = canvas.width / 2 + (world.x - ship.x) * scale;
  out.y = canvas.height / 2 + (world.y - ship.y) * scale;
  return out;
}

export function projectWorldToScreen(
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1
): { x: number; y: number } {
  const projected = projectWorldToScreenInto(projectScratch, world, ship, canvas, scale);
  return { x: projected.x, y: projected.y };
}

export function isRockOnCanvas(
  world: Position,
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1,
  margin = 0
): boolean {
  const screen = projectWorldToScreenInto(projectScratch, world, ship, canvas, scale);
  return (
    screen.x >= -margin &&
    screen.x <= canvas.width + margin &&
    screen.y >= -margin &&
    screen.y <= canvas.height + margin
  );
}

export function isDrawablePlayfieldRock(roid: PlayfieldRock): boolean {
  if (roid.pendingDestruction) {
    return false;
  }
  if (!Number.isFinite(roid.position.x) || !Number.isFinite(roid.position.y)) {
    return false;
  }
  if (roid.r !== undefined && !Number.isFinite(roid.r)) {
    return false;
  }
  if (roid.angle !== undefined && !Number.isFinite(roid.angle)) {
    return false;
  }
  return true;
}

export function countRocksOnCanvas(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize,
  scale = 1,
  margin = 0
): number {
  let count = 0;
  for (const roid of roids) {
    if (isRockOnCanvas(roid.position, ship, canvas, scale, margin)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Keep 1:1 only while a real share of the belt is on the playfield:
 * ≥ max(2, 25% of drawable rocks) inside the comfort inset *and* the
 * contained pack centroid still on the canvas.
 *
 * #469's "2 rocks + centroid" pin failed when the belt was a ring around
 * the ship (centroid at the camera, 2 inner stragglers, 18 dots on radar
 * only) — Pilot B ~60s nearly-empty. One escaped wrap pose also must not
 * set the fit distance; frame the contained belt so late-join 10k rocks
 * cannot crush the pack to hairlines.
 */
export function playfieldZoom(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize
): number {
  let drawable = 0;
  let sx = 0;
  let sy = 0;
  let maxDist = 1;
  let comfortable = 0;
  for (const roid of roids) {
    if (!isDrawablePlayfieldRock(roid)) {
      continue;
    }
    drawable += 1;
    containAsteroidPositionInto(containScratch, roid.position.x, roid.position.y);
    sx += containScratch.x;
    sy += containScratch.y;
    const reach = Math.hypot(containScratch.x - ship.x, containScratch.y - ship.y) + (roid.r ?? 0);
    if (Number.isFinite(reach) && reach > maxDist) {
      maxDist = reach;
    }
    if (isRockOnCanvas(containScratch, ship, canvas, 1, -PLAYFIELD_COMFORT_INSET)) {
      comfortable += 1;
    }
  }
  if (drawable === 0) {
    return 1;
  }
  centroidScratch.x = sx / drawable;
  centroidScratch.y = sy / drawable;
  const lookingAtPack =
    comfortable >= playfieldMinVisible(drawable) &&
    isRockOnCanvas(centroidScratch, ship, canvas, 1, -PLAYFIELD_COMFORT_INSET);
  if (lookingAtPack) {
    return 1;
  }
  const inset = Math.min(canvas.width, canvas.height) / 2 - 24;
  if (inset <= 0) {
    return 1;
  }
  return Math.min(1, inset / maxDist);
}

/** PO / QA bar: if radar has dots, the playfield must show at least one rock. */
export function radarBeltVisibleOnPlayfield(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize
): boolean {
  let drawable = 0;
  for (const roid of roids) {
    if (isDrawablePlayfieldRock(roid)) {
      drawable += 1;
    }
  }
  if (drawable === 0) {
    return false;
  }
  const scale = playfieldZoom(roids, ship, canvas);
  for (const roid of roids) {
    if (isDrawablePlayfieldRock(roid) && isRockOnCanvas(roid.position, ship, canvas, scale)) {
      return true;
    }
  }
  return false;
}

const EMPTY_OFFSETS = [1];

/** Stroke path for a roid. Empty offsets still paint a circle so radar dots are not holes. */
export function drawingOffsets(offsets: readonly number[]): readonly number[] {
  return offsets.length > 0 ? offsets : EMPTY_OFFSETS;
}
