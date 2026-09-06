import { VISUAL } from '../../constants';

export function hudFont(sizePx: number, weight: 'normal' | 'bold' = 'normal'): string {
  const weightPrefix = weight === 'bold' ? 'bold ' : '';
  return `${weightPrefix}${sizePx}px ${VISUAL.HUD_FONT_FAMILY}`;
}
