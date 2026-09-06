/**
 * Saucer NPC art. The UFO-disc is a TEMPORARY stand-in (John rejected it).
 * Register a Landsat painter and call `setSaucerNpcArtId('landsat')` to swap —
 * do not grow the disc. Ambient NPC, not a kit, not a faction mark.
 */

export const SAUCER_NPC_RENDER_LANGUAGE = 'svg-fidelity' as const;

/** Reserved id for the Game Director Landsat redo. No painter yet. */
export type SaucerNpcArtId = 'disc-temp' | 'landsat';

export const SAUCER_NPC_ART_ID: SaucerNpcArtId = 'disc-temp';
export const SAUCER_NPC_ART_IS_TEMPORARY = true;

export interface SaucerNpcPainter {
  id: SaucerNpcArtId;
  temporary: boolean;
  draw: (
    ctx: CanvasRenderingContext2D,
    target: SaucerNpcDrawTarget,
    options?: SaucerNpcDrawOptions
  ) => void;
}

const painters = new Map<SaucerNpcArtId, SaucerNpcPainter>();
let activeArtId: SaucerNpcArtId = SAUCER_NPC_ART_ID;

export function registerSaucerNpcPainter(painter: SaucerNpcPainter): void {
  painters.set(painter.id, painter);
}

export function getSaucerNpcArtId(): SaucerNpcArtId {
  return activeArtId;
}

export function setSaucerNpcArtId(id: SaucerNpcArtId): void {
  activeArtId = id;
}

export function getSaucerNpcPainter(id: SaucerNpcArtId = activeArtId): SaucerNpcPainter {
  return painters.get(id) ?? painters.get(SAUCER_NPC_ART_ID) ?? discTempPainter;
}

export function isSaucerNpcArtTemporary(): boolean {
  return getSaucerNpcPainter().temporary;
}

export const SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE = false;

/** Ambient saucer hull. Not ION/EMBER and not a player-kit stroke. */
export const SAUCER_HULL_COLOR = '#C4B5FD';

/** Saucer shot tint. Independent of player laser colors. */
export const SAUCER_SHOT_COLOR = '#E9D5FF';

/** Cabin fill stays a soft wash (≤20% alpha). AD sheet: 0.18. */
export const SAUCER_CABIN_FILL_ALPHA = 0.18;

export const SAUCER_RING_TICKS = 8;

/** Short segments off both rims while firing (art-pack firing SVG). */
export const SAUCER_FIRING_SEGMENTS = 2;

/** Repo-relative AD box paths. Canvas drawer replicates these SVGs. */
export const SAUCER_ART_PACK = {
  idleSvg: 'georoids-art/saucer-npc.svg',
  firingSvg: 'georoids-art/saucer-npc-firing.svg',
  silhouettePreview: 'georoids-art/saucer-silhouette-svgish.png',
} as const;

export interface SaucerNpcDrawTarget {
  x: number;
  y: number;
  radius: number;
}

export interface SaucerNpcDrawOptions {
  firing?: boolean;
  hullColor?: string;
  shotColor?: string;
}

function ringRadii(radius: number): {
  outerW: number;
  outerH: number;
  innerW: number;
  innerH: number;
} {
  return {
    outerW: radius * 1.85,
    outerH: radius * 0.58,
    innerW: radius * 1.35,
    innerH: radius * 0.42,
  };
}

function strokeEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRingTicks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  tickLen: number
): void {
  for (let i = 0; i < SAUCER_RING_TICKS; i++) {
    const t = (i / SAUCER_RING_TICKS) * Math.PI * 2;
    const nx = Math.cos(t) / rx;
    const ny = Math.sin(t) / ry;
    const inv = 1 / Math.hypot(nx, ny);
    const px = x + Math.cos(t) * rx;
    const py = y + Math.sin(t) * ry;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + nx * inv * tickLen, py + ny * inv * tickLen);
    ctx.stroke();
  }
}

/** Temporary UFO-disc. Landsat replaces this via `registerSaucerNpcPainter`. */
function drawDiscTempSaucerNpc(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  options: SaucerNpcDrawOptions = {}
): void {
  const { x, y, radius } = target;
  const hull = options.hullColor ?? SAUCER_HULL_COLOR;
  const shot = options.shotColor ?? SAUCER_SHOT_COLOR;
  const { outerW, outerH, innerW, innerH } = ringRadii(radius);
  const cabinW = radius * 0.62;
  const cabinH = radius * 0.34;
  const cabinY = y - radius * 0.22;
  const strokeW = Math.max(1.25, radius * 0.07);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = hull;
  ctx.lineWidth = strokeW;

  strokeEllipse(ctx, x, y, outerW, outerH);
  drawRingTicks(ctx, x, y, outerW, outerH, Math.max(2.5, radius * 0.16));
  strokeEllipse(ctx, x, y, innerW, innerH);

  ctx.fillStyle = hull;
  ctx.globalAlpha = SAUCER_CABIN_FILL_ALPHA;
  ctx.beginPath();
  ctx.ellipse(x, cabinY, cabinW, cabinH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = strokeW * 1.15;
  strokeEllipse(ctx, x, cabinY, cabinW, cabinH);

  const antennaTop = cabinY - cabinH - radius * 0.42;
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.moveTo(x, cabinY - cabinH);
  ctx.lineTo(x, antennaTop);
  ctx.stroke();
  const dishR = Math.max(2.2, radius * 0.14);
  ctx.beginPath();
  ctx.arc(x, antennaTop, dishR, 0, Math.PI * 2);
  ctx.stroke();

  if (options.firing) {
    ctx.strokeStyle = shot;
    ctx.lineWidth = Math.max(1.5, radius * 0.09);
    const shotGap = Math.max(3, radius * 0.28);
    const shotLen = Math.max(6, radius * 0.67);
    for (const dir of [-1, 1] as const) {
      const start = x + dir * (outerW + shotGap);
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.lineTo(start + dir * shotLen, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

const discTempPainter: SaucerNpcPainter = {
  id: 'disc-temp',
  temporary: true,
  draw: drawDiscTempSaucerNpc,
};
registerSaucerNpcPainter(discTempPainter);

/** Dispatches through the active painter. Callers do not branch on art id. */
export function drawSaucerNpc(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  options: SaucerNpcDrawOptions = {}
): void {
  getSaucerNpcPainter().draw(ctx, target, options);
}

/** @deprecated Use drawSaucerNpc. Kept so existing callers keep compiling. */
export function drawSaucerNpcPlaceholder(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  color: string = SAUCER_HULL_COLOR
): void {
  drawSaucerNpc(ctx, target, { hullColor: color });
}

export function drawSaucerNpcFiring(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  color: string = SAUCER_HULL_COLOR
): void {
  drawSaucerNpc(ctx, target, { hullColor: color, firing: true });
}
