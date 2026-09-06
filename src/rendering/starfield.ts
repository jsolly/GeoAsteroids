import type { Position } from '../../shared-types';
import { PALETTE, VISUAL } from '../constants';
import { getGameBoundary } from '../physics/boundary';
import { hexToRgba } from '../utils/colorUtils';
import { canvasManager } from './canvas';

export interface Star {
  x: number;
  y: number;
  alpha: number;
}

// mulberry32: tiny deterministic PRNG so the sky is identical on every client and every frame.
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStarfield(
  count: number,
  radius: number,
  seed: number,
  cx = 0,
  cy = 0
): Star[] {
  const rng = createRng(seed);
  const stars: Star[] = [];
  const alphaRange = VISUAL.STAR_ALPHA_MAX - VISUAL.STAR_ALPHA_MIN;
  while (stars.length < count) {
    const x = (rng() * 2 - 1) * radius;
    const y = (rng() * 2 - 1) * radius;
    if (x * x + y * y > radius * radius) {
      continue;
    }
    stars.push({ x: cx + x, y: cy + y, alpha: VISUAL.STAR_ALPHA_MIN + rng() * alphaRange });
  }
  return stars;
}

let cachedStars: Star[] | null = null;

function getStars(): Star[] {
  if (!cachedStars) {
    const boundary = getGameBoundary();
    cachedStars = generateStarfield(
      VISUAL.STAR_COUNT,
      boundary.radius,
      VISUAL.STAR_SEED,
      boundary.cx,
      boundary.cy
    );
  }
  return cachedStars;
}

export function drawStarfield(shipPosition: Position): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  const size = VISUAL.STAR_SIZE;
  const offsetX = cvs.width / 2 - shipPosition.x;
  const offsetY = cvs.height / 2 - shipPosition.y;

  ctx.save();
  for (const star of getStars()) {
    const sx = star.x + offsetX;
    const sy = star.y + offsetY;
    if (sx < -size || sy < -size || sx > cvs.width + size || sy > cvs.height + size) {
      continue;
    }
    ctx.fillStyle = hexToRgba(PALETTE.STARS, star.alpha);
    ctx.fillRect(Math.round(sx), Math.round(sy), size, size);
  }
  ctx.restore();
}
