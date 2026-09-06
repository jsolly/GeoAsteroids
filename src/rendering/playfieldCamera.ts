import type { Position } from '../../shared-types';
import { containAsteroidPosition } from '../physics/asteroidMotion';

export type PlayfieldSize = { width: number; height: number };
export type PlayfieldRock = {
  position: Position;
  r?: number;
  angle?: number;
  pendingDestruction?: boolean;
};

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
  return roids.filter((roid) => isRockOnCanvas(roid.position, ship, canvas, scale, margin)).length;
}

function beltCentroid(roids: readonly PlayfieldRock[]): Position {
  let x = 0;
  let y = 0;
  for (const roid of roids) {
    x += roid.position.x;
    y += roid.position.y;
  }
  const n = roids.length;
  return { x: x / n, y: y / n };
}

function farthestReach(roids: readonly PlayfieldRock[], ship: Position): number {
  let maxDist = 1;
  for (const roid of roids) {
    const reach = Math.hypot(roid.position.x - ship.x, roid.position.y - ship.y) + (roid.r ?? 0);
    if (Number.isFinite(reach) && reach > maxDist) {
      maxDist = reach;
    }
  }
  return maxDist;
}

function fitFarthestRock(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize
): number {
  const inset = Math.min(canvas.width, canvas.height) / 2 - 24;
  if (inset <= 0) {
    return 1;
  }
  return Math.min(1, inset / farthestReach(roids, ship));
}

function frameRock(roid: PlayfieldRock): PlayfieldRock {
  return {
    ...roid,
    position: containAsteroidPosition(roid.position.x, roid.position.y),
  };
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
  const belt = roids.filter(isDrawablePlayfieldRock).map(frameRock);
  if (belt.length === 0) {
    return 1;
  }
  const comfortable = countRocksOnCanvas(belt, ship, canvas, 1, -PLAYFIELD_COMFORT_INSET);
  const lookingAtPack =
    comfortable >= playfieldMinVisible(belt.length) &&
    isRockOnCanvas(beltCentroid(belt), ship, canvas, 1, -PLAYFIELD_COMFORT_INSET);
  if (lookingAtPack) {
    return 1;
  }
  return fitFarthestRock(belt, ship, canvas);
}

/** PO / QA bar: if radar has dots, the playfield must show at least one rock. */
export function radarBeltVisibleOnPlayfield(
  roids: readonly PlayfieldRock[],
  ship: Position,
  canvas: PlayfieldSize
): boolean {
  const belt = roids.filter(isDrawablePlayfieldRock);
  if (belt.length === 0) {
    return false;
  }
  return countRocksOnCanvas(belt, ship, canvas, playfieldZoom(roids, ship, canvas)) > 0;
}

/** Stroke path for a roid. Empty offsets still paint a circle so radar dots are not holes. */
export function drawingOffsets(offsets: readonly number[]): number[] {
  if (offsets.length > 0) {
    return [...offsets];
  }
  return [1];
}
