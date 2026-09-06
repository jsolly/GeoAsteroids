import { expect, test } from 'vitest';

import { PALETTE, VISUAL } from '../../../src/constants';
import { healthFillColor } from '../../../src/rendering/hud/healthBar';
import { formatScore, parseOverlayText } from '../../../src/rendering/hud/overlayCopy';
import { hudFont } from '../../../src/rendering/hud/typography';
import {
  connectionFailureText,
  DISCONNECT_BANNER_TEXT,
  GAME_OVER_HINT,
  GAME_OVER_TITLE,
  MENU_PLAY_LABEL,
} from '../../../src/ui/copy';

test('HUD type uses the locked monospace stack, never Arial', () => {
  expect(VISUAL.HUD_FONT_FAMILY.toLowerCase()).not.toContain('arial');
  expect(hudFont(14).toLowerCase()).not.toContain('arial');
  expect(hudFont(14)).toContain(VISUAL.HUD_FONT_FAMILY);
});

test('lives icons stay smaller than the playfield ship', () => {
  expect(VISUAL.LIVES_ICON_SIZE).toBeLessThan(24);
});

test('health fill stays on the locked palette', () => {
  expect(healthFillColor(1)).toBe(PALETTE.HEALTH);
  expect(healthFillColor(0.31)).toBe(PALETTE.HEALTH);
  expect(healthFillColor(0.3)).toBe(PALETTE.DANGER);
  expect(healthFillColor(0)).toBe(PALETTE.DANGER);
  expect(healthFillColor(1).toLowerCase()).not.toBe('#ffffff');
  expect(healthFillColor(0).toLowerCase()).not.toBe('#ffffff');
});

test('score stays a plain readable integer', () => {
  expect(formatScore(0)).toBe('0');
  expect(formatScore(240)).toBe('240');
  expect(formatScore(-4)).toBe('0');
  expect(formatScore(12.9)).toBe('12');
});

test('game-over overlay copy is crisp and uncluttered', () => {
  const over = parseOverlayText('Game Over: You were killed by Nova');
  expect(over.kind).toBe('gameOver');
  expect(over.title).toBe(GAME_OVER_TITLE);
  expect(over.detail).toBe('You were killed by Nova');
  expect(over.hint).toBe(GAME_OVER_HINT);

  const bare = parseOverlayText('Game Over');
  expect(bare.kind).toBe('gameOver');
  expect(bare.title).toBe(GAME_OVER_TITLE);
  expect(bare.detail).toBe('');
});

test('death and notice overlays keep their source line', () => {
  expect(parseOverlayText('You were killed by a roid')).toEqual({
    kind: 'death',
    detail: 'You were killed by a roid',
  });
  expect(parseOverlayText('Get ready')).toEqual({
    kind: 'notice',
    detail: 'Get ready',
  });
});

test('menu and disconnect copy stay short', () => {
  expect(MENU_PLAY_LABEL).toBe('PLAY');
  expect(DISCONNECT_BANNER_TEXT.toLowerCase()).not.toContain('white');
  expect(connectionFailureText('network')).toBe('CANNOT REACH SERVER');
  expect(connectionFailureText('timeout')).toBe('CONNECTION TIMED OUT');
});
