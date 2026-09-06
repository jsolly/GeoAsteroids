import { PALETTE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import type { Ship } from '../ship/Ship';
import type { FuelDrop } from './FuelDrop';

export function drawFuelDropsRelative(ship: Ship, drops: FuelDrop[]): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  for (const drop of drops) {
    const screenPos = canvasManager.worldToScreen(drop.position, ship.position);
    ctx.save();
    ctx.strokeStyle = PALETTE.FUEL;
    ctx.lineWidth = VISUAL.FUEL_STROKE_WIDTH;
    ctx.shadowColor = PALETTE.FUEL;
    ctx.shadowBlur = Math.min(ctx.lineWidth, VISUAL.FUEL_GLOW);
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, drop.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screenPos.x, screenPos.y - drop.r * 0.45);
    ctx.lineTo(screenPos.x, screenPos.y + drop.r * 0.45);
    ctx.moveTo(screenPos.x - drop.r * 0.45, screenPos.y);
    ctx.lineTo(screenPos.x + drop.r * 0.45, screenPos.y);
    ctx.stroke();
    ctx.restore();
  }
}
