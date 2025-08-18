import { getCTX, SHOW_COLLISION_CIRCLES } from '../../constants';
import type { Ship } from '../../entities/ship/Ship.ts';
import { worldToScreen } from '../../rendering/viewport.ts';
import type { Asteroid } from './Asteroid';

export function drawRoidsRelative(ship: Ship, roids: Asteroid[]): void {
  const ctx = getCTX();
  if (!ctx) {
    return;
  }

  for (const roid of roids) {
    ctx.strokeStyle = 'slategrey';
    ctx.lineWidth = 1.5;

    // Convert asteroid world position to screen position using viewport transformation
    const screenPos = worldToScreen(roid.position, ship.position);

    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;

    // draw a path
    ctx.beginPath();
    ctx.moveTo(
      screenPos.x + r * offsets[0] * Math.cos(a),
      screenPos.y + r * offsets[0] * Math.sin(a)
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      ctx.lineTo(
        screenPos.x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
        screenPos.y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices)
      );
    }
    ctx.closePath();
    ctx.stroke();

    // show asteroid's collision circle
    if (SHOW_COLLISION_CIRCLES) {
      ctx.strokeStyle = 'lime';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, r, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }
}
