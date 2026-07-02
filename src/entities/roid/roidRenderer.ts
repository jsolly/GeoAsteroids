import type { Ship } from '../../entities/ship/Ship';
import { canvasManager } from '../../rendering/canvas';

import type { Roid } from './Roid';

export function drawRoidsRelative(ship: Ship, roids: Roid[]): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  for (const roid of roids) {
    ctx.strokeStyle = 'slategrey';
    ctx.lineWidth = 1.5;

    // Convert roid world position to screen position using viewport transformation
    const screenPos = canvasManager.worldToScreen(roid.position, ship.position);

    const r = roid.r;
    const angle = roid.angle;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
    const firstOffset = offsets[0];
    if (firstOffset === undefined) {
      continue;
    }

    // draw a path
    ctx.beginPath();
    ctx.moveTo(
      screenPos.x + r * firstOffset * Math.cos(angle),
      screenPos.y + r * firstOffset * Math.sin(angle)
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      const offset = offsets[j];
      if (offset === undefined) {
        continue;
      }
      ctx.lineTo(
        screenPos.x + r * offset * Math.cos(angle + (j * Math.PI * 2) / vertices),
        screenPos.y + r * offset * Math.sin(angle + (j * Math.PI * 2) / vertices)
      );
    }
    ctx.closePath();
    ctx.stroke();
  }
}
