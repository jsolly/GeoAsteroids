import type { FactionId } from '../../shared-types';
import { PALETTE, TITLE } from '../constants';

export type FactionType = 'local' | 'remote' | 'bot';

/** Ownership stroke (local / remote / bot). Soft faction never paints the hull. */
export function getShipDisplayColor(player: {
  type: FactionType;
  faction?: FactionId;
  factionId?: FactionId;
  color?: string;
}): string {
  return getFactionColor(player.type);
}

export function getFactionColor(type: FactionType): string {
  switch (type) {
    case 'local':
      return PALETTE.LOCAL;
    case 'remote':
      return PALETTE.REMOTE;
    case 'bot':
      return PALETTE.BOT;
  }
}

export function getLaserColor(isLocal: boolean): string {
  return isLocal ? PALETTE.LASER_LOCAL : PALETTE.LASER_ENEMY;
}

const RGBA_ALPHA_BUCKETS = 100;
const rgbaCache = new Map<string, Map<number, string>>();

function quantizedAlpha(alpha: number): number {
  const clamped = Math.min(1, Math.max(0, alpha));
  return Math.round(clamped * RGBA_ALPHA_BUCKETS) / RGBA_ALPHA_BUCKETS;
}

export function hexToRgba(hex: string, alpha: number): string {
  const bucket = quantizedAlpha(alpha);
  let byAlpha = rgbaCache.get(hex);
  if (!byAlpha) {
    byAlpha = new Map();
    rgbaCache.set(hex, byAlpha);
  }
  const cached = byAlpha.get(bucket);
  if (cached !== undefined) {
    return cached;
  }

  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const value = `rgba(${r}, ${g}, ${b}, ${bucket})`;
  byAlpha.set(bucket, value);
  return value;
}

/** @deprecated Playfield ships use getFactionColor(type). Kept for server join fallbacks. */
export function generateRandomPlayerColor(): string {
  return PALETTE.REMOTE;
}

/** Mirror locked hexes into CSS custom properties for the title/menu shell. */
export function applyLockedPaletteCss(
  root: CSSStyleDeclaration = document.documentElement.style
): void {
  root.setProperty('--palette-bg', PALETTE.BG);
  root.setProperty('--palette-stars', PALETTE.STARS);
  root.setProperty('--palette-accent', TITLE.ACCENT);
  root.setProperty('--palette-local', PALETTE.LOCAL);
  root.setProperty('--palette-hud', PALETTE.HUD);
  root.setProperty('--palette-hud-muted', PALETTE.HUD_MUTED);
  root.setProperty('--palette-danger', PALETTE.DANGER);
  root.setProperty('--palette-laser', PALETTE.LASER_LOCAL);
}
