import type { SoftFactionId } from './softFactions';

/** Game Director art call. Tiny marks only — never hull paint. */
export const FACTION_MARK_COLORS = {
  ion: '#A8A0C8',
  ember: '#D4B896',
} as const;

/** Ownership hull strokes. Soft factions must not reuse these as hull fill/stroke. */
export const OWNERSHIP_HULL_COLORS = {
  local: '#5EEAD4',
  bot: '#FB923C',
} as const;

export const FACTION_MARK_RADIUS_RATIO = 0.26;

export interface FactionMarkTarget {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export type FactionMarkPainter = (ctx: CanvasRenderingContext2D, mark: FactionMarkTarget) => void;

function heading(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

function paintIonChevron(ctx: CanvasRenderingContext2D, mark: FactionMarkTarget): void {
  const size = Math.max(2.4, mark.radius * FACTION_MARK_RADIUS_RATIO);
  const fwd = heading(mark.angle);
  const leftX = -fwd.y;
  const leftY = fwd.x;
  const tipX = mark.x + fwd.x * size;
  const tipY = mark.y + fwd.y * size;
  const aft = size * 0.85;
  const spread = size * 0.7;

  ctx.save();
  ctx.strokeStyle = FACTION_MARK_COLORS.ion;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX - fwd.x * aft + leftX * spread, tipY - fwd.y * aft + leftY * spread);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - fwd.x * aft - leftX * spread, tipY - fwd.y * aft - leftY * spread);
  ctx.stroke();
  ctx.restore();
}

function paintEmberDiamond(ctx: CanvasRenderingContext2D, mark: FactionMarkTarget): void {
  const size = Math.max(2.4, mark.radius * FACTION_MARK_RADIUS_RATIO);
  const fwd = heading(mark.angle);
  const leftX = -fwd.y;
  const leftY = fwd.x;

  ctx.save();
  ctx.strokeStyle = FACTION_MARK_COLORS.ember;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(mark.x + fwd.x * size, mark.y + fwd.y * size);
  ctx.lineTo(mark.x + leftX * size * 0.65, mark.y + leftY * size * 0.65);
  ctx.lineTo(mark.x - fwd.x * size, mark.y - fwd.y * size);
  ctx.lineTo(mark.x - leftX * size * 0.65, mark.y - leftY * size * 0.65);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Soft-faction art hook. Swap a painter without recoloring hulls.
 * ION = chevron, EMBER = diamond.
 */
export const FACTION_MARK_PAINTERS: Record<SoftFactionId, FactionMarkPainter> = {
  ion: paintIonChevron,
  ember: paintEmberDiamond,
};

export function registerFactionMarkPainter(id: SoftFactionId, painter: FactionMarkPainter): void {
  FACTION_MARK_PAINTERS[id] = painter;
}

export function getFactionMarkColor(id: SoftFactionId): string {
  return FACTION_MARK_COLORS[id];
}

/** Tiny mark only. No-op when the factions stream has not assigned a side. */
export function drawSoftFactionMark(
  ctx: CanvasRenderingContext2D,
  factionId: SoftFactionId | undefined,
  mark: FactionMarkTarget
): void {
  if (!factionId) {
    return;
  }
  FACTION_MARK_PAINTERS[factionId]?.(ctx, mark);
}
