import type { LootData, LootKind } from '../../../shared-types';
import { PALETTE, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import type { Ship } from '../ship/Ship';
import { LootField } from './LootField';

export function lootStrokeColor(kind: LootKind): string {
  if (kind === 'fuel') {
    return PALETTE.HEALTH;
  }
  if (kind === 'shard') {
    return PALETTE.LASER_LOCAL;
  }
  return PALETTE.LOOT;
}

/** Screen-space pickup radius. Live zoom must not erase the diamond. */
export function lootScreenRadius(worldRadius: number, scale: number): number {
  const scaled = worldRadius * scale;
  if (!Number.isFinite(scaled) || scaled <= 0) {
    return VISUAL.LOOT_MIN_SCREEN_PX;
  }
  return Math.max(VISUAL.LOOT_MIN_SCREEN_PX, scaled);
}

/** Phosphor diamond pickups — hairline stroke, glow capped to stroke. */
export function drawLootRelative(ship: Ship, loot: readonly LootData[]): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const scale = canvasManager.getPlayfieldScale();
  const blast = LootField.getInstance().getBlast();
  if (blast) {
    const screen = canvasManager.worldToScreen(blast.position, ship.position);
    const r = blast.radius * scale;
    if (Number.isFinite(screen.x) && Number.isFinite(screen.y) && Number.isFinite(r)) {
      ctx.save();
      ctx.lineWidth = VISUAL.LOOT_STROKE_WIDTH;
      ctx.strokeStyle = PALETTE.DANGER;
      ctx.shadowColor = PALETTE.DANGER;
      ctx.shadowBlur = VISUAL.LOOT_GLOW;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (loot.length === 0) {
    return;
  }

  for (const drop of loot) {
    const screen = canvasManager.worldToScreen(drop.position, ship.position);
    const r = lootScreenRadius(drop.radius, scale);
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
      continue;
    }

    const isFuel = drop.kind === 'fuel';
    const color = lootStrokeColor(drop.kind);
    const trace = (): void => {
      ctx.beginPath();
      if (isFuel) {
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.moveTo(screen.x, screen.y - r * 0.45);
        ctx.lineTo(screen.x, screen.y + r * 0.45);
        ctx.moveTo(screen.x - r * 0.45, screen.y);
        ctx.lineTo(screen.x + r * 0.45, screen.y);
        return;
      }
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
    ctx.shadowColor = color;
    ctx.shadowBlur = VISUAL.LOOT_GLOW;
    ctx.strokeStyle = hexToRgba(color, 0.62);
    trace();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    trace();
    ctx.stroke();
    ctx.restore();
  }
}
