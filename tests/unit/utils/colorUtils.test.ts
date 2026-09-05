import { expect, test } from 'vitest';

import { DEBUG, PALETTE, ROID, VISUAL } from '../../../src/constants';
import { getRoidStrokeWidth } from '../../../src/entities/roid/roidRenderer';
import { Player } from '../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import { Ship } from '../../../src/entities/ship/Ship';
import {
  generateRandomPlayerColor,
  getFactionColor,
  getLaserColor,
  hexToRgba,
} from '../../../src/utils/colorUtils';
import { isDebugMode } from '../../../src/utils/debugUtils';

test('locked palette hexes match the art-direction swatch', () => {
  expect(PALETTE.BG).toBe('#000011');
  expect(PALETTE.STARS).toBe('#8BA3C7');
  expect(PALETTE.LOCAL).toBe('#5EEAD4');
  expect(PALETTE.REMOTE).toBe('#7DD3FC');
  expect(PALETTE.BOT).toBe('#FB923C');
  expect(PALETTE.ROID).toBe('#94A3B8');
  expect(PALETTE.LASER_LOCAL).toBe('#FDE68A');
  expect(PALETTE.LASER_ENEMY).toBe('#FCA5A5');
  expect(PALETTE.HUD).toBe('#E2E8F0');
  expect(PALETTE.HUD_MUTED).toBe('#64748B');
  expect(PALETTE.DANGER).toBe('#F43F5E');
  expect(PALETTE.HEALTH).toBe('#4ADE80');
  expect(PALETTE.ACCENT_UI).toBe('#A78BFA');
});

test('faction colors map local mint, remote sky, bot amber', () => {
  expect(getFactionColor('local')).toBe(PALETTE.LOCAL);
  expect(getFactionColor('remote')).toBe(PALETTE.REMOTE);
  expect(getFactionColor('bot')).toBe(PALETTE.BOT);
});

test('laser colors never use white', () => {
  expect(getLaserColor(true)).toBe(PALETTE.LASER_LOCAL);
  expect(getLaserColor(false)).toBe(PALETTE.LASER_ENEMY);
  expect(getLaserColor(true).toLowerCase()).not.toBe('#ffffff');
  expect(getLaserColor(false).toLowerCase()).not.toBe('#ffffff');
});

test('new players and ships default to faction colors instead of white', () => {
  const local = new Player({
    id: 'p-local',
    name: 'Local',
    type: 'local',
    input: new MockPlayerInput(),
  });
  const remote = new Player({
    id: 'p-remote',
    name: 'Remote',
    type: 'remote',
    input: new MockPlayerInput(),
  });
  const bot = new Player({
    id: 'p-bot',
    name: 'Bot',
    type: 'bot',
    input: new MockPlayerInput(),
  });

  expect(local.color).toBe(PALETTE.LOCAL);
  expect(local.ship.color).toBe(PALETTE.LOCAL);
  expect(remote.color).toBe(PALETTE.REMOTE);
  expect(bot.color).toBe(PALETTE.BOT);
  expect(new Ship().color).toBe(PALETTE.LOCAL);
  expect(generateRandomPlayerColor().toLowerCase()).not.toBe('#ffffff');
});

test('hexToRgba preserves locked hex channels', () => {
  expect(hexToRgba(PALETTE.LOCAL, 0.5)).toBe('rgba(94, 234, 212, 0.5)');
});

test('roid stroke weights follow three size tiers', () => {
  expect(getRoidStrokeWidth(ROID.SIZE)).toBe(VISUAL.ROID_STROKE_LARGE);
  expect(getRoidStrokeWidth(ROID.SIZE * 0.5)).toBe(VISUAL.ROID_STROKE_MEDIUM);
  expect(getRoidStrokeWidth(ROID.SIZE * 0.2)).toBe(VISUAL.ROID_STROKE_SMALL);
});

test('projectile and glow caps stay small', () => {
  expect(VISUAL.LASER_RADIUS).toBe(3);
  expect(VISUAL.LASER_GLOW).toBeLessThanOrEqual(VISUAL.LASER_RADIUS);
  expect(VISUAL.SHIP_GLOW).toBeLessThanOrEqual(VISUAL.SHIP_STROKE_WIDTH);
  expect(VISUAL.BOUNDARY_GLOW).toBeLessThanOrEqual(VISUAL.BOUNDARY_STROKE_WIDTH);
});

test('default play path keeps debug chrome gated off', () => {
  expect(DEBUG.ENABLED).toBe(false);
  expect(isDebugMode()).toBe(false);
});
