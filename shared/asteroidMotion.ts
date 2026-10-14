import { WORLD } from './world';

/** Return a drifting asteroid inside the circular world at its outer edge. */
export function containAsteroidPositionInto(
  dest: { x: number; y: number },
  x: number,
  y: number
): { x: number; y: number } {
  const radius = WORLD.radius;
  const dx = x;
  const dy = y;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) {
    dest.x = x;
    dest.y = y;
    return dest;
  }
  const scale = (radius - 1e-5) / dist;
  dest.x = dx * scale;
  dest.y = dy * scale;
  return dest;
}

export function containAsteroidPosition(x: number, y: number): { x: number; y: number } {
  return containAsteroidPositionInto({ x: 0, y: 0 }, x, y);
}

export function stepAsteroidMotionInto(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  tickScale: number,
  outPosition: { x: number; y: number },
  outVelocity: { x: number; y: number }
): void {
  const radius = WORLD.radius;
  let x = position.x + velocity.x * tickScale;
  let y = position.y + velocity.y * tickScale;
  let vx = velocity.x;
  let vy = velocity.y;

  const dx = x;
  const dy = y;
  const dist = Math.hypot(dx, dy);
  if (dist > radius && dist > 0) {
    containAsteroidPositionInto(outPosition, x, y);
    x = outPosition.x;
    y = outPosition.y;
    const nx = dx / dist;
    const ny = dy / dist;
    const radial = vx * nx + vy * ny;
    if (radial > 0) {
      vx -= 2 * radial * nx;
      vy -= 2 * radial * ny;
    }
  }

  outPosition.x = x;
  outPosition.y = y;
  outVelocity.x = vx;
  outVelocity.y = vy;
}

export function stepAsteroidMotion(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  tickScale = 1
): { position: { x: number; y: number }; velocity: { x: number; y: number } } {
  const nextPosition = { x: 0, y: 0 };
  const nextVelocity = { x: 0, y: 0 };
  stepAsteroidMotionInto(position, velocity, tickScale, nextPosition, nextVelocity);
  return { position: nextPosition, velocity: nextVelocity };
}
