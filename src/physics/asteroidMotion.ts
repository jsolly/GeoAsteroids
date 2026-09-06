import { GAME, ROID } from '../constants';
import { getGameBoundary } from './boundary';

/** Shared belt radius: inside the ship-kill wall, near a typical camera. */
export function getAsteroidFieldRadius(): number {
  return Math.min(getGameBoundary().radius, ROID.FIELD_RADIUS);
}

/**
 * Pull an escaped pose back onto the shared belt along the same ray.
 * Opposite-side wrap at the 3100 arena wall (see #437) parked the field at
 * ~3000px — on the minimap, off the ship camera — which is the >60s empty
 * canvas. Same-ray contain keeps late-join / live-server 10k poses in view.
 */
export function containAsteroidPosition(x: number, y: number): { x: number; y: number } {
  const { cx, cy } = getGameBoundary();
  const radius = getAsteroidFieldRadius();
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) {
    return { x, y };
  }
  const scale = (radius * ROID.FIELD_INNER_SCALE) / dist;
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** @deprecated Use containAsteroidPosition — kept for call sites during the belt fix. */
export function wrapAsteroidPosition(x: number, y: number): { x: number; y: number } {
  return containAsteroidPosition(x, y);
}

export function stepAsteroidMotion(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  tickScale = 1
): { position: { x: number; y: number }; velocity: { x: number; y: number } } {
  const { cx, cy } = getGameBoundary();
  const radius = getAsteroidFieldRadius();
  let x = position.x + velocity.x * tickScale;
  let y = position.y + velocity.y * tickScale;
  let vx = velocity.x;
  let vy = velocity.y;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > radius && dist > 0) {
    const contained = containAsteroidPosition(x, y);
    x = contained.x;
    y = contained.y;
    const nx = dx / dist;
    const ny = dy / dist;
    const radial = vx * nx + vy * ny;
    if (radial > 0) {
      vx -= 2 * radial * nx;
      vy -= 2 * radial * ny;
    }
  }

  return { position: { x, y }, velocity: { x: vx, y: vy } };
}

/** Advance one 60 FPS tick (or a dt-scaled fraction), then keep the belt in-field. */
export function stepAsteroidPosition(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  tickScale = 1
): { x: number; y: number } {
  return stepAsteroidMotion(position, velocity, tickScale).position;
}

/** Convert a wall-clock frame delta into 60 FPS tick units. */
export function asteroidTickScale(dtMs: number): number {
  const frameMs = 1000 / GAME.FPS;
  return Math.min(Math.max(dtMs, 0), 50) / frameMs;
}

/** True when a world pose would paint on a ship-centered canvas. */
export function isOnPlayfieldCanvas(
  world: { x: number; y: number },
  ship: { x: number; y: number },
  canvas: { width: number; height: number } = { width: 1920, height: 1080 }
): boolean {
  const screenX = canvas.width / 2 - ship.x + world.x;
  const screenY = canvas.height / 2 - ship.y + world.y;
  return screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height;
}
