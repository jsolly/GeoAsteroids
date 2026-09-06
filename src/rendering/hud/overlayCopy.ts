import { GAME_OVER_HINT, GAME_OVER_TITLE } from '../../ui/copy';

export type OverlayKind = 'gameOver' | 'death' | 'notice';

export interface OverlayCopy {
  kind: OverlayKind;
  title?: string;
  detail: string;
  hint?: string;
}

export function parseOverlayText(text: string): OverlayCopy {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const isGameOver = lower.includes('game over');
  const isDeath = lower.includes('killed by');

  if (isGameOver) {
    const detail = trimmed.replace(/^game over:\s*/i, '').trim();
    return {
      kind: 'gameOver',
      title: GAME_OVER_TITLE,
      detail: detail.toLowerCase() === 'game over' ? '' : detail,
      hint: GAME_OVER_HINT,
    };
  }

  if (isDeath) {
    return { kind: 'death', detail: trimmed };
  }

  return { kind: 'notice', detail: trimmed };
}

export function formatScore(score: number): string {
  return String(Math.max(0, Math.floor(score)));
}
