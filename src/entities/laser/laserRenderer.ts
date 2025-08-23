import { LASER_EXPLODE_DUR } from '../../constants/entities/laser';
import { FPS } from '../../constants/game';
import { canvasManager } from '../../rendering/canvas';
import type { Laser } from './Laser';

// Interface for boundary objects
interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Laser-specific rendering functions
export function drawLaser(laser: Laser, shipPosition: { x: number; y: number }): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs || laser.explodeTime > 0) {
    return;
  }

  // Convert world coordinates to screen coordinates
  const screenX = laser.position.x - shipPosition.x + cvs.width / 2;
  const screenY = laser.position.y - shipPosition.y + cvs.height / 2;

  // Draw laser beam
  drawLaserBeam(ctx, screenX, screenY, laser);
}

function drawLaserBeam(ctx: CanvasRenderingContext2D, x: number, y: number, laser: Laser): void {
  ctx.save();
  ctx.translate(x, y);

  // Laser beam with glow effect
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 8;

  // Outer glow
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(laser.velocity.x * 0.1, laser.velocity.y * 0.1);
  ctx.stroke();

  // Inner core
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(laser.velocity.x * 0.1, laser.velocity.y * 0.1);
  ctx.stroke();

  ctx.restore();
}

export function drawLaserExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  laser: Laser
): void {
  if (laser.explodeTime <= 0) {
    return;
  }

  const maxExplodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
  const explosionProgress = 1 - laser.explodeTime / maxExplodeTime;
  const radius = 8 * (1 + explosionProgress * 2);

  ctx.save();
  ctx.translate(x, y);

  // Laser explosion effect
  ctx.globalAlpha = 1 - explosionProgress;

  // Outer ring
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner particles
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 1 - explosionProgress * 0.7;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const particleRadius = radius * 0.5 * explosionProgress;
    const px = Math.cos(angle) * particleRadius;
    const py = Math.sin(angle) * particleRadius;

    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawLaserMiniMap(
  laser: Laser,
  boundary: Boundary,
  ctx: CanvasRenderingContext2D
): void {
  if (laser.explodeTime > 0) {
    return;
  }

  // Convert world coordinates to mini-map coordinates
  const miniMapScale = 0.1;
  const miniMapX = (laser.position.x - boundary.x) * miniMapScale;
  const miniMapY = (laser.position.y - boundary.y) * miniMapScale;

  // Draw laser dot on mini-map
  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(miniMapX, miniMapY, 1, 0, Math.PI * 2);
  ctx.fill();
}
