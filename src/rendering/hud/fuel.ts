import { PALETTE, SHIP, VISUAL } from '../../constants';

export function drawFuelGauge(
  ctx: CanvasRenderingContext2D,
  fuel: number,
  maxFuel: number
): void {
  if (maxFuel <= 0) {
    return;
  }

  const barWidth = VISUAL.FUEL_BAR_WIDTH;
  const barHeight = VISUAL.FUEL_BAR_HEIGHT;
  const barX = 20;
  const barY = 20 + SHIP.SIZE + 26;
  const filled = barWidth * Math.max(0, Math.min(1, fuel / maxFuel));

  ctx.save();
  ctx.lineWidth = barHeight;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = PALETTE.HUD_MUTED;
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + barWidth, barY);
  ctx.stroke();
  if (filled > 0) {
    ctx.strokeStyle = PALETTE.FUEL;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + filled, barY);
    ctx.stroke();
  }
  ctx.restore();
}
