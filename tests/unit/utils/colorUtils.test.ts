import { expect, test } from 'vitest';
import { ROID, WIRE_PALETTE } from '../../../shared/constants/gameplay';
import { PALETTE, VISUAL } from '../../../src/constants';
import { Player } from '../../../src/entities/player/Player';
import { getRoidStrokeWidth } from '../../../src/entities/roid/roidRenderer';
import { Ship } from '../../../src/entities/ship/Ship';

import { hexToRgba, laserBoltColor } from '../../../src/utils/colorUtils';

test('laser colors never use white', () => {
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 0)).toBe(PALETTE.LASER_LOCAL);
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 1)).toBe(PALETTE.DANGER);
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 1).toLowerCase()).not.toBe('#ffffff');
});

test('players and ships use the role palette instead of white', () => {
  const local = new Player({
    id: 'p-local',
    name: 'Local',
    type: 'local',
  });
  const remote = new Player({
    id: 'p-remote',
    name: 'Remote',
    type: 'remote',
  });

  expect(local.color).toBe(PALETTE.LOCAL);
  expect(local.ship.color).toBe(PALETTE.LOCAL);
  expect(remote.color).toBe(WIRE_PALETTE.REMOTE);
  expect(new Ship().color).toBe(PALETTE.LOCAL);
});

test('hexToRgba preserves locked hex channels', () => {
  expect(hexToRgba(PALETTE.LOCAL, 0.5)).toBe('rgba(94, 234, 212, 0.5)');
});

test('hexToRgba returns the same string instance for the same quantized alpha', () => {
  const a = hexToRgba(PALETTE.STARS, 0.42);
  const b = hexToRgba(PALETTE.STARS, 0.42);
  expect(a).toBe(b);
});

test('roid stroke weights follow four size tiers', () => {
  expect(getRoidStrokeWidth(ROID.COLOSSAL_MIN_SIZE)).toBe(VISUAL.ROID_STROKE_COLOSSAL);
  expect(getRoidStrokeWidth(ROID.COLOSSAL_SIZE)).toBe(VISUAL.ROID_STROKE_COLOSSAL);
  expect(getRoidStrokeWidth(ROID.SIZE)).toBe(VISUAL.ROID_STROKE_LARGE);
  expect(getRoidStrokeWidth(ROID.SIZE * 0.5)).toBe(VISUAL.ROID_STROKE_MEDIUM);
  expect(getRoidStrokeWidth(ROID.SIZE * 0.2)).toBe(VISUAL.ROID_STROKE_SMALL);
});
