import type { Position } from '../../shared-types';
import { PALETTE, VISUAL } from '../constants';
import { getGameBoundary } from '../physics/boundary';
import { logger } from '../utils/Logger';
import { canvasManager } from './canvas';

export function drawFieryBoundary(shipPosition: Position): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs) {
    logger.warn('BOUNDARY_RENDERER', 'Canvas or context not available');
    return;
  }

  const boundary = getGameBoundary();
  const centerX = cvs.width / 2 - shipPosition.x + boundary.cx;
  const centerY = cvs.height / 2 - shipPosition.y + boundary.cy;
  const radius = boundary.radius;

  ctx.save();
  ctx.shadowColor = PALETTE.HUD_MUTED;
  ctx.shadowBlur = VISUAL.BOUNDARY_GLOW;
  ctx.strokeStyle = PALETTE.HUD_MUTED;
  ctx.lineWidth = VISUAL.BOUNDARY_STROKE_WIDTH;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
