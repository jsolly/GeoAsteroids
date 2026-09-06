/**
 * Saucer NPC render hook.
 *
 * Higher-fidelity SVG-ish disc: stacked ellipses, ring ticks, antenna,
 * soft cabin fill. Ambient hull — not a faction mark, and not the
 * outline-asteroids kit language used by player ships.
 */

export const SAUCER_NPC_RENDER_LANGUAGE = 'svg-fidelity' as const;

export const SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE = false;

/** Ambient saucer hull. Not ION/EMBER and not a player-kit stroke. */
export const SAUCER_HULL_COLOR = '#C4B5FD';

/** Saucer shot tint. Independent of player laser colors. */
export const SAUCER_SHOT_COLOR = '#E9D5FF';

/** Cabin fill stays a soft wash (≤20% alpha). */
export const SAUCER_CABIN_FILL_ALPHA = 0.2;

export interface SaucerNpcDrawTarget {
  x: number;
  y: number;
  radius: number;
}

/**
 * SVG-ish saucer. Call from a future NPC drawer; player kits stay triangles
 * until the AD outline pack is locked.
 */
export function drawSaucerNpcPlaceholder(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  color: string = SAUCER_HULL_COLOR
): void {
  const { x, y, radius } = target;
  const hullW = radius * 1.7;
  const hullH = radius * 0.52;
  const cabinW = radius * 0.72;
  const cabinH = radius * 0.38;

  ctx.save();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.08, hullW, hullH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.18, hullW * 0.72, hullH * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = SAUCER_CABIN_FILL_ALPHA;
  ctx.fillStyle = SAUCER_SHOT_COLOR;
  ctx.beginPath();
  ctx.ellipse(x, y - radius * 0.18, cabinW, cabinH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.08);
  const tickCount = 8;
  for (let i = 0; i < tickCount; i++) {
    const t = (i / tickCount) * Math.PI * 2;
    const inner = 0.78;
    const outer = 0.98;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(t) * hullW * inner, y + radius * 0.08 + Math.sin(t) * hullH * inner);
    ctx.lineTo(x + Math.cos(t) * hullW * outer, y + radius * 0.08 + Math.sin(t) * hullH * outer);
    ctx.stroke();
  }

  const dishX = x + radius * 0.55;
  const dishY = y - radius * 0.55;
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.2, y - radius * 0.05);
  ctx.lineTo(dishX, dishY);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(dishX, dishY, radius * 0.22, radius * 0.12, -0.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
