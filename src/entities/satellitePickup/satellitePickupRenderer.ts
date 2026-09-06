import type { Position } from '../../../shared-types';
import { PALETTE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import type { SatellitePickup } from './SatellitePickup';

export function drawSatellitePickups(pickups: SatellitePickup[], viewer: Position): void {
  for (const pickup of pickups) {
    drawSatellitePickup(pickup, viewer);
  }
}

export function drawSatellitePickup(pickup: SatellitePickup, viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const screen = canvasManager.worldToScreen(pickup.position, viewer);
  const color = pickup.color || PALETTE.SATELLITE_PICKUP;
  const orbiting = pickup.state === 'orbiting';
  drawVectorSatellite(ctx, screen.x, screen.y, pickup.radius, pickup.angle, color, orbiting);
}

function drawVectorSatellite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: string,
  orbiting: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.SHIP_GLOW;
  ctx.lineWidth = VISUAL.SHIP_STROKE_WIDTH;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = orbiting ? 0.95 : 1;

  ctx.beginPath();
  ctx.moveTo(-radius * 1.35, 0);
  ctx.lineTo(radius * 1.35, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.35, -radius * 0.45);
  ctx.lineTo(radius * 0.35, -radius * 0.45);
  ctx.lineTo(0, radius * 0.55);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -radius * 0.15, radius * 0.42, Math.PI, 0);
  ctx.stroke();

  ctx.restore();
}

export function drawSatellitePickupMiniMapDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.fillStyle = hexToRgba(PALETTE.SATELLITE_PICKUP, 0.9);
  ctx.beginPath();
  ctx.arc(x, y, VISUAL.MINIMAP_DOT / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
