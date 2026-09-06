import { PALETTE, ROID, VISUAL } from '../../constants';
import type { Ship } from '../../entities/ship/Ship';
import { canvasManager } from '../../rendering/canvas';

import type { Roid } from './Roid';

export function getRoidStrokeWidth(radius: number): number {
  if (radius >= ROID.SIZE * 0.8) {
    return VISUAL.ROID_STROKE_LARGE;
  }
  if (radius >= ROID.SIZE * 0.4) {
    return VISUAL.ROID_STROKE_MEDIUM;
  }
  return VISUAL.ROID_STROKE_SMALL;
}

const roidScreen = { x: 0, y: 0 };

export function drawRoidsRelative(ship: Ship, roids: Roid[]): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx) {
    return;
  }

  const viewW = cvs?.width ?? Number.POSITIVE_INFINITY;
  const viewH = cvs?.height ?? Number.POSITIVE_INFINITY;

  ctx.strokeStyle = PALETTE.ROID;
  ctx.shadowColor = PALETTE.ROID;
  ctx.shadowBlur = VISUAL.ROID_GLOW;

  for (const roid of roids) {
    const screenPos = canvasManager.worldToScreenInto(roidScreen, roid.position, ship.position);
    const r = roid.r;
    if (
      screenPos.x < -r ||
      screenPos.y < -r ||
      screenPos.x > viewW + r ||
      screenPos.y > viewH + r
    ) {
      continue;
    }

    ctx.lineWidth = getRoidStrokeWidth(r);

    const angle = roid.angle;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
    const firstOffset = offsets[0];
    if (firstOffset === undefined) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(
      screenPos.x + r * firstOffset * Math.cos(angle),
      screenPos.y + r * firstOffset * Math.sin(angle)
    );
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

  ctx.shadowBlur = 0;
}
