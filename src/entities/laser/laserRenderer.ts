import { GAME, LASER, PALETTE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { strokeBurstTicks } from '../../rendering/vectorJuice';
import { hexToRgba } from '../../utils/colorUtils';
import type { Laser } from './Laser';

interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawLaser(laser: Laser, shipPosition: { x: number; y: number }): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs || laser.explodeTime > 0) {
    return;
  }

  const screenX = laser.position.x - shipPosition.x + cvs.width / 2;
  const screenY = laser.position.y - shipPosition.y + cvs.height / 2;

  drawLaserBeam(ctx, screenX, screenY, laser);
}

function drawLaserBeam(ctx: CanvasRenderingContext2D, x: number, y: number, laser: Laser): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = PALETTE.LASER_LOCAL;
  ctx.shadowBlur = VISUAL.LASER_GLOW;
  ctx.strokeStyle = PALETTE.LASER_LOCAL;
  ctx.lineWidth = VISUAL.LASER_STROKE_WIDTH;
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

  const maxExplodeTime = Math.ceil(LASER.EXPLODE_DURATION * GAME.FPS);
  const explosionProgress = 1 - laser.explodeTime / maxExplodeTime;
  const radius = VISUAL.LASER_EXPLODE_RADIUS * (1 + explosionProgress);
  const alpha = 1 - explosionProgress;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = PALETTE.LASER_LOCAL;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  strokeBurstTicks(
    ctx,
    x,
    y,
    VISUAL.LASER_HIT_TICKS,
    explosionProgress,
    radius * 0.35,
    radius * 1.25,
    PALETTE.LASER_LOCAL,
    alpha,
    1,
    VISUAL.LASER_GLOW
  );
}

export function drawLaserMiniMap(
  laser: Laser,
  boundary: Boundary,
  ctx: CanvasRenderingContext2D
): void {
  if (laser.explodeTime > 0) {
    return;
  }

  const miniMapScale = 0.1;
  const miniMapX = (laser.position.x - boundary.x) * miniMapScale;
  const miniMapY = (laser.position.y - boundary.y) * miniMapScale;

  ctx.fillStyle = hexToRgba(PALETTE.LASER_LOCAL, 0.85);
  ctx.beginPath();
  ctx.arc(miniMapX, miniMapY, 1, 0, Math.PI * 2);
  ctx.fill();
}
