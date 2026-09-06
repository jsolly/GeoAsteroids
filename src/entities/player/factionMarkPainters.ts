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
/** Live zoom can shrink hulls to ~2–4px. Marks must still read as ION / EMBER. */
export const FACTION_MARK_MIN_SCREEN_PX = 5.5;
/** Stay a chip, never a second hull. */
export const FACTION_MARK_MAX_SCREEN_PX = 8;
/** Hull marks sit just ahead of the silhouette, not buried in the stroke. */
export const FACTION_MARK_HULL_OFFSET_MAX_PX = 12;

export interface FactionMarkTarget {
  x: number;
  y: number;
  radius: number;
  angle: number;
  /** hull = park ahead of the ship. point = sit on the given HUD/nameplate pixel. */
  park?: 'hull' | 'point';
}

export type FactionMarkPainter = (ctx: CanvasRenderingContext2D, mark: FactionMarkTarget) => void;

function heading(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

/** Screen-space size that survives playfield zoom without becoming a second hull. */
export function factionMarkScreenSize(radius: number): number {
  const raw = radius * FACTION_MARK_RADIUS_RATIO;
  if (!Number.isFinite(raw) || raw <= 0) {
    return FACTION_MARK_MIN_SCREEN_PX;
  }
  return Math.min(FACTION_MARK_MAX_SCREEN_PX, Math.max(FACTION_MARK_MIN_SCREEN_PX, raw));
}

export function factionMarkAnchor(mark: FactionMarkTarget): {
  x: number;
  y: number;
  size: number;
} {
  const size = factionMarkScreenSize(mark.radius);
  if (mark.park !== 'hull') {
    return { x: mark.x, y: mark.y, size };
  }
  const fwd = heading(mark.angle);
  const hull = Number.isFinite(mark.radius) ? Math.max(0, mark.radius) : 0;
  const offset = Math.min(FACTION_MARK_HULL_OFFSET_MAX_PX, hull + size * 0.55);
  return {
    x: mark.x + fwd.x * offset,
    y: mark.y + fwd.y * offset,
    size,
  };
}

function paintIonChevron(ctx: CanvasRenderingContext2D, mark: FactionMarkTarget): void {
  const { x, y, size } = factionMarkAnchor(mark);
  const fwd = heading(mark.angle);
  const leftX = -fwd.y;
  const leftY = fwd.x;
  const tipX = x + fwd.x * size;
  const tipY = y + fwd.y * size;
  const aft = size * 0.85;
  const spread = size * 0.7;

  ctx.save();
  ctx.strokeStyle = FACTION_MARK_COLORS.ion;
  ctx.lineWidth = 1.25;
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
  const { x, y, size } = factionMarkAnchor(mark);
  const fwd = heading(mark.angle);
  const leftX = -fwd.y;
  const leftY = fwd.x;

  ctx.save();
  ctx.strokeStyle = FACTION_MARK_COLORS.ember;
  ctx.lineWidth = 1.25;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + fwd.x * size, y + fwd.y * size);
  ctx.lineTo(x + leftX * size * 0.65, y + leftY * size * 0.65);
  ctx.lineTo(x - fwd.x * size, y - fwd.y * size);
  ctx.lineTo(x - leftX * size * 0.65, y - leftY * size * 0.65);
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
