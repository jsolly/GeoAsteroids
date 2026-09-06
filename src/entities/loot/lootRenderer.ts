import type { LootData } from '../../../shared-types';
import { PALETTE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import type { Ship } from '../ship/Ship';

/** Phosphor diamond pickups — hairline stroke, glow capped to stroke. */
export function drawLootRelative(ship: Ship, loot: readonly LootData[]): void {
  const ctx = canvasManager.getContext();
  if (!ctx || loot.length === 0) {
    return;
  }

  const scale = canvasManager.getPlayfieldScale();

  for (const drop of loot) {
    const screen = canvasManager.worldToScreen(drop.position, ship.position);
    const r = drop.radius * scale;
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y) || !Number.isFinite(r)) {
      continue;
    }

    const trace = (): void => {
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - r);
      ctx.lineTo(screen.x + r, screen.y);
      ctx.lineTo(screen.x, screen.y + r);
      ctx.lineTo(screen.x - r, screen.y);
      ctx.closePath();
    };

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = VISUAL.LOOT_STROKE_WIDTH;
    ctx.shadowColor = PALETTE.LOOT;
    ctx.shadowBlur = VISUAL.LOOT_GLOW;
    ctx.strokeStyle = hexToRgba(PALETTE.LOOT, 0.45);
    trace();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = PALETTE.LOOT;
    trace();
    ctx.stroke();
    ctx.restore();
  }
}
