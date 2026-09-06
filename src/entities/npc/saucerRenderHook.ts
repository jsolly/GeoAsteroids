/**
 * Saucer NPC render hook.
 *
 * The saucer is allowed higher-fidelity (SVG-like filled) geometry.
 * Do not force it into the Matt-blush outline-asteroids kit language
 * used by Dart / Hauler / Warden / Skirmisher / Quake.
 */

export const SAUCER_NPC_RENDER_LANGUAGE = 'svg-fidelity' as const;

export const SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE = false;

export interface SaucerNpcDrawTarget {
  x: number;
  y: number;
  radius: number;
}

/**
 * Placeholder saucer disc. Callers may replace this with SVG-like fidelity
 * without changing player-kit hulls.
 */
export function drawSaucerNpcPlaceholder(
  ctx: CanvasRenderingContext2D,
  target: SaucerNpcDrawTarget,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(target.x, target.y, target.radius * 1.6, target.radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(target.x, target.y - target.radius * 0.15, target.radius * 0.7, target.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
