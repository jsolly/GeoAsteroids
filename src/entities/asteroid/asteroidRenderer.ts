import { SHOW_COLLISION_CIRCLES } from '../../constants/game';
import { getCTX } from '../../constants/rendering/canvas';
import type { Ship } from '../../entities/ship/Ship';
import { worldToScreen } from '../../rendering/viewport';
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
    const angle = roid.angle;
    const vertices = roid.vertices;
    const offsets = roid.offsets;

    // draw a path
    ctx.beginPath();
    ctx.moveTo(
      screenPos.x + r * offsets[0] * Math.cos(angle),
      screenPos.y + r * offsets[0] * Math.sin(angle)
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      ctx.lineTo(
        screenPos.x + r * offsets[j] * Math.cos(angle + (j * Math.PI * 2) / vertices),
        screenPos.y + r * offsets[j] * Math.sin(angle + (j * Math.PI * 2) / vertices)
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
