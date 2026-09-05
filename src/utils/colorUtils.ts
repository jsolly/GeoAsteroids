import { PALETTE } from '../constants';

export type FactionType = 'local' | 'remote' | 'bot';

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

export function hexToRgba(hex: string, alpha: number): string {
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
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** @deprecated Playfield ships use getFactionColor(type). Kept for server join fallbacks. */
export function generateRandomPlayerColor(): string {
  return PALETTE.REMOTE;
}
