import type { Position } from '../../shared-types';
import { getGameBoundary } from '../physics/boundary';
import { canvasManager } from './canvas';

export function drawFieryBoundary(shipPosition: Position): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs) {
    return;
  }

  const boundary = getGameBoundary();

  // Convert world coordinates to screen coordinates
  const centerX = cvs.width / 2 - shipPosition.x + boundary.cx;
  const centerY = cvs.height / 2 - shipPosition.y + boundary.cy;
  const radius = boundary.radius;

  // Create fiery effect with multiple layers
  const time = Date.now() * 0.005; // Animation speed

  // Draw outer fiery glow (circle)
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ff4400';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw inner fiery border
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw animated fiery core
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsl(${15 + Math.sin(time) * 10}, 100%, 50%)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Reset shadow
  ctx.shadowBlur = 0;
}
