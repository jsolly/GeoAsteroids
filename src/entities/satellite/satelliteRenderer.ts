import type { Position } from '../../../shared-types';
import { PALETTE, SATELLITE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import { drawLaserBolts } from '../ship/shipRenderer';
import type { Satellite } from './Satellite';

export function drawSatellites(satellites: Satellite[], viewer: Position): void {
  for (const satellite of satellites) {
    drawSatellite(satellite, viewer);
    drawLaserBolts(satellite.lasers, PALETTE.LASER_ENEMY, viewer);
  }
}

export function drawSatellite(satellite: Satellite, viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const screen = canvasManager.worldToScreen(satellite.position, viewer);
  const color = satellite.color || PALETTE.SATELLITE;

  if (satellite.exploding) {
    drawSatelliteExplosion(ctx, screen.x, screen.y, satellite);
    return;
  }

  drawSaucer(ctx, screen.x, screen.y, satellite.radius, satellite.angle, color);
  drawSatelliteHealth(ctx, screen.x, screen.y, satellite);
}

function drawSaucer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.SHIP_GLOW;
  ctx.lineWidth = VISUAL.SHIP_STROKE_WIDTH;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.2, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x, y - radius * 0.18, radius * 0.55, radius * 0.4, 0, Math.PI, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - radius * 0.75, y);
  ctx.lineTo(x + radius * 0.75, y);
  ctx.stroke();

  const noseX = x + Math.cos(angle) * radius * 0.95;
  const noseY = y - Math.sin(angle) * radius * 0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(noseX, noseY);
  ctx.stroke();

  ctx.restore();
}

function drawSatelliteExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  satellite: Satellite
): void {
  const t = 1 - satellite.explodeTime / SATELLITE.EXPLODE_DURATION_FRAMES;
  const alpha = 1 - t * 0.85;
  const spread = satellite.radius * VISUAL.EXPLOSION_SPREAD_RATIO * t;
  const color = satellite.color || PALETTE.SATELLITE;
  const fragments = [
    { dx: -1, dy: -0.3, w: satellite.radius * 1.1, h: 0 },
    { dx: 1, dy: -0.2, w: satellite.radius * 0.9, h: 0 },
    { dx: 0, dy: -1, w: satellite.radius * 0.6, h: 0 },
    { dx: 0.2, dy: 0.8, w: satellite.radius * 0.7, h: 0 },
  ];

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.EXPLOSION_STROKE_WIDTH;
  ctx.lineWidth = VISUAL.EXPLOSION_STROKE_WIDTH;
  ctx.lineCap = 'butt';

  for (const fragment of fragments) {
    const cx = x + fragment.dx * spread;
    const cy = y + fragment.dy * spread;
    const spin = t * 0.8;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    const hx = (fragment.w / 2) * cos;
    const hy = (fragment.w / 2) * sin;
    ctx.beginPath();
    ctx.moveTo(cx - hx, cy - hy);
    ctx.lineTo(cx + hx, cy + hy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSatelliteHealth(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  satellite: Satellite
): void {
  if (satellite.health >= satellite.maxHealth) {
    return;
  }

  const barWidth = satellite.radius * 2.4;
  const barY = screenY - satellite.radius - 8;
  const barX = screenX - barWidth / 2;
  const healthPercent = Math.max(0, satellite.health / satellite.maxHealth);

  ctx.save();
  ctx.lineWidth = VISUAL.HEALTH_CAPSULE_HEIGHT;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = hexToRgba(PALETTE.HUD_MUTED, 0.45);
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + barWidth, barY);
  ctx.stroke();
  if (healthPercent > 0) {
    ctx.strokeStyle = PALETTE.HEALTH;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barWidth * healthPercent, barY);
    ctx.stroke();
  }
  ctx.restore();
}
