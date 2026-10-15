import { expect, test } from 'vitest';
import { ROID } from '../../../shared/constants/gameplay';
import { PALETTE, VISUAL } from '../../../src/constants';
import { createPlayer } from '../../../src/entities/player/createPlayer';
import { Player } from '../../../src/entities/player/Player';
import { getRoidStrokeWidth } from '../../../src/entities/roid/roidRenderer';
import { Ship } from '../../../src/entities/ship/Ship';

import { hexToRgba, laserBoltColor } from '../../../src/utils/colorUtils';

test('laser colors never use white', () => {
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 0)).toBe(PALETTE.LASER_LOCAL);
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 1)).toBe(PALETTE.DANGER);
  expect(laserBoltColor(PALETTE.LASER_LOCAL, 1).toLowerCase()).not.toBe('#ffffff');
});

test('players keep their hull color through creation and authoritative updates', () => {
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

  expect(local.color).toBe('#5EEAD4');
  expect(local.ship.color).toBe('#5EEAD4');
  expect(remote.color).toBe('#7DD3FC');
  expect(remote.ship.color).toBe('#7DD3FC');
  expect(new Ship().color).toBe('#5EEAD4');

  const custom = createPlayer({
    id: 'p-custom',
    name: 'Custom',
    type: 'local',
    position: { x: 0, y: 0 },
    color: '#123456',
  });
  expect(custom.color).toBe('#123456');
  expect(custom.ship.color).toBe('#123456');

  custom.updateFromServer({ color: '#123456' });
  expect(custom.color).toBe('#5EEAD4');
  expect(custom.ship.color).toBe('#5EEAD4');
  local.updateFromServer({ color: '#FBBF24' });
  expect(local.color).toBe('#FBBF24');
  expect(local.ship.color).toBe('#FBBF24');
  local.updateFromServer({});
  expect(local.color).toBe('#FBBF24');
  expect(local.ship.color).toBe('#FBBF24');

  remote.updateFromServer({ color: '#123456' });
  expect(remote.color).toBe('#123456');
  expect(remote.ship.color).toBe('#123456');
  remote.updateFromServer({ kitId: 'hauler' });
  expect(remote.ship.kitId).toBe('hauler');
  expect(remote.color).toBe('#123456');
  expect(remote.ship.color).toBe('#123456');
  remote.updateFromServer({ kitId: 'scout', color: '#ABCDEF' });
  expect(remote.ship.kitId).toBe('scout');
  expect(remote.color).toBe('#ABCDEF');
  expect(remote.ship.color).toBe('#ABCDEF');

  custom.color = '#C084FC';
  expect(custom.color).toBe('#C084FC');
  expect(custom.ship.color).toBe('#C084FC');
  custom.ship.color = '#F97316';
  expect(custom.color).toBe('#F97316');
  expect(custom.ship.color).toBe('#F97316');
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
