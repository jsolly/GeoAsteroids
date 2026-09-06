import { PALETTE, VISUAL } from '../../constants';
import { HULL_LABEL } from '../../ui/copy';
import { hexToRgba } from '../../utils/colorUtils';
import { isDebugMode } from '../../utils/debugUtils';
import { hudFont } from './typography';

export function healthFillColor(percent: number): string {
  return percent <= VISUAL.HUD_HEALTH_LOW ? PALETTE.DANGER : PALETTE.HEALTH;
}

/** Hairline hull meter shared by floating ship capsules and the corner HUD. */
export function drawHealthCapsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  health: number,
  maxHealth: number
): void {
  const ratio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
  const currentWidth = width * ratio;

  ctx.save();
  ctx.lineWidth = VISUAL.HEALTH_CAPSULE_HEIGHT;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = hexToRgba(PALETTE.HUD_MUTED, 0.45);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  if (currentWidth > 0) {
    ctx.strokeStyle = healthFillColor(ratio);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + currentWidth, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHudHealthBar(
  ctx: CanvasRenderingContext2D,
  health: number,
  maxHealth: number,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.fillStyle = PALETTE.HUD_MUTED;
  ctx.font = hudFont(10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(HULL_LABEL, x, y - 4);
  ctx.restore();

  drawHealthCapsule(ctx, x, y, VISUAL.HUD_HEALTH_WIDTH, health, maxHealth);

  if (isDebugMode()) {
    ctx.save();
    ctx.fillStyle = PALETTE.HUD;
    ctx.font = hudFont(10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.ceil(health)}/${maxHealth}`, x, y + 6);
    ctx.restore();
  }
}
