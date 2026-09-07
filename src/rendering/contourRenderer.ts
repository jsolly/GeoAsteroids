import type { Position } from '../../shared-types';
import { PALETTE, VISUAL } from '../constants';
import { getTerrainContours } from '../physics/terrain/terrainSession';
import { hexToRgba } from '../utils/colorUtils';
import { canvasManager } from './canvas';

/**
 * Muted topo lines in world space. Tight spacing is steep; keep alpha low so
 * ships, lasers, and roids stay readable on top.
 */
export function drawIsoContours(shipPosition: Position): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  const levels = getTerrainContours();
  if (levels.length === 0) {
    return;
  }

  const pad = 32;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;

  for (const level of levels) {
    const isIndex = level.index % VISUAL.CONTOUR_INDEX_EVERY === 0;
    ctx.strokeStyle = hexToRgba(
      PALETTE.CONTOUR,
      isIndex ? VISUAL.CONTOUR_INDEX_ALPHA : VISUAL.CONTOUR_ALPHA
    );
    ctx.lineWidth = VISUAL.CONTOUR_STROKE_WIDTH;
    ctx.beginPath();

    for (const segment of level.segments) {
      const a = canvasManager.worldToScreen({ x: segment.ax, y: segment.ay }, shipPosition);
      const b = canvasManager.worldToScreen({ x: segment.bx, y: segment.by }, shipPosition);
      if (
        (a.x < -pad && b.x < -pad) ||
        (a.x > cvs.width + pad && b.x > cvs.width + pad) ||
        (a.y < -pad && b.y < -pad) ||
        (a.y > cvs.height + pad && b.y > cvs.height + pad)
      ) {
        continue;
      }
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }

    ctx.stroke();
  }

  ctx.restore();
}
