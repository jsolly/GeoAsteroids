import { getGameBoundary } from './boundary';

/**
 * Keep a roid inside the circular arena by wrapping to the opposite side
 * just inside the boundary. Escaped live-server poses (10k+ px) snap back
 * on the next tick so the ship-relative camera can see the field.
 */
export function wrapAsteroidPosition(x: number, y: number): { x: number; y: number } {
  const { cx, cy, radius } = getGameBoundary();
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) {
    return { x, y };
  }
  const scale = (radius * 0.96) / dist;
  return { x: cx - dx * scale, y: cy - dy * scale };
}

/** Advance one 60 FPS tick, then wrap if the pose left the arena. */
export function stepAsteroidPosition(
  position: { x: number; y: number },
  velocity: { x: number; y: number }
): { x: number; y: number } {
  return wrapAsteroidPosition(position.x + velocity.x, position.y + velocity.y);
}
