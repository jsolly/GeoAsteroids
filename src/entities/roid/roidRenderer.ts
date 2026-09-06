import { PALETTE, ROID, VISUAL } from '../../constants';
import type { Ship } from '../../entities/ship/Ship';
import { canvasManager } from '../../rendering/canvas';
import { drawingOffsets } from '../../rendering/playfieldCamera';

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

/** Skip a pose that would throw during path construction and crash the frame. */
export function canDrawAsteroid(roid: {
  position: { x: number; y: number };
  r: number;
  angle: number;
  offsets: number[];
}): boolean {
  const offsets = drawingOffsets(roid.offsets);
  return (
    Number.isFinite(roid.position.x) &&
    Number.isFinite(roid.position.y) &&
    Number.isFinite(roid.r) &&
    Number.isFinite(roid.angle) &&
    Number.isFinite(offsets[0])
  );
}

export function drawRoidsRelative(ship: Ship, roids: Roid[]): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  for (const roid of roids) {
    if (!canDrawAsteroid(roid)) {
      continue;
    }
    ctx.strokeStyle = PALETTE.ROID;
    ctx.lineWidth = getRoidStrokeWidth(roid.r);
    ctx.shadowColor = PALETTE.ROID;
    ctx.shadowBlur = Math.min(ctx.lineWidth, VISUAL.ROID_GLOW);

    const screenPos = canvasManager.worldToScreen(roid.position, ship.position);
    const scale = canvasManager.getPlayfieldScale();

    const r = roid.r * scale;
    const angle = roid.angle;
    const vertices = Math.max(roid.vertices, 1);
    const offsets = drawingOffsets(roid.offsets);
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
      const offset = offsets[j] ?? 1;
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
