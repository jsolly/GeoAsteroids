import type { Position } from '../../../shared-types';
import { PALETTE, SATELLITE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import { drawSaucerNpc, SAUCER_HULL_COLOR, SAUCER_SHOT_COLOR } from '../npc/saucerRenderHook';
import { drawLaserBolts } from '../ship/shipRenderer';
import type { Satellite } from './Satellite';

export function drawSatellites(satellites: Satellite[], viewer: Position): void {
  for (const satellite of satellites) {
    drawSatellite(satellite, viewer);
    drawLaserBolts(satellite.lasers, SAUCER_SHOT_COLOR, viewer);
  }
}

export function drawSatellite(satellite: Satellite, viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const screen = canvasManager.worldToScreen(satellite.position, viewer);
  const color = satellite.color || SAUCER_HULL_COLOR;

  if (satellite.exploding) {
    drawSatelliteExplosion(ctx, screen.x, screen.y, satellite);
    return;
  }

  drawSaucerNpc(
    ctx,
    { x: screen.x, y: screen.y, radius: satellite.radius },
    {
      hullColor: color,
      firing: satellite.lasers.length > 0,
    }
  );
  drawSatelliteHealth(ctx, screen.x, screen.y, satellite);
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
  const color = satellite.color || SAUCER_HULL_COLOR;
  const fragments = [
    { dx: -1, dy: -0.3, w: satellite.radius * 1.1 },
    { dx: 1, dy: -0.2, w: satellite.radius * 0.9 },
    { dx: 0, dy: -1, w: satellite.radius * 0.6 },
    { dx: 0.2, dy: 0.8, w: satellite.radius * 0.7 },
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
