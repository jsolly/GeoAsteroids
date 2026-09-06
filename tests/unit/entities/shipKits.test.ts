import { expect, test } from 'vitest';
import { SHIP } from '../../../src/constants';
import {
  AD_V2_HULL_TOPOLOGY,
  applyShipKitToShip,
  DEFAULT_SHIP_KIT_ID,
  getShipKit,
  KIT_HULLS_ARE_PLACEHOLDERS,
  listShipKits,
  SHIP_KIT_IDS,
} from '../../../src/entities/ship/shipKits';
import { Ship } from '../../../src/entities/ship/Ship';

test('kit roster is Dart / Hauler / Warden / Skirmisher / Quake', () => {
  expect(SHIP_KIT_IDS).toEqual(['dart', 'hauler', 'warden', 'skirmisher', 'quake']);
  expect(listShipKits().map((kit) => kit.name)).toEqual([
    'Dart',
    'Hauler',
    'Warden',
    'Skirmisher',
    'Quake',
  ]);
  expect(listShipKits().some((kit) => kit.name === 'Surveyor')).toBe(false);
});

test('Dart keeps classic ship numbers so existing play stays familiar', () => {
  expect(DEFAULT_SHIP_KIT_ID).toBe('dart');
  const dart = getShipKit('dart');
  expect(dart.maxHealth).toBe(SHIP.MAX_HEALTH);
  expect(dart.size).toBe(SHIP.SIZE);
  expect(dart.turnSpeed).toBe(SHIP.TURN_SPEED);
  const ship = new Ship();
  expect(ship.kitId).toBe('dart');
  expect(ship.maxHealth).toBe(SHIP.MAX_HEALTH);
  expect(ship.turnSpeed).toBe(SHIP.TURN_SPEED);
});

test('kit abilities are mixed flavors and geo is optional', () => {
  const flavors = new Set(listShipKits().map((kit) => kit.flavor));
  expect(flavors.has('combat')).toBe(true);
  expect(flavors.has('utility')).toBe(true);
  expect(flavors.has('geo')).toBe(true);
  expect(listShipKits().every((kit) => kit.flavor === 'geo')).toBe(false);
  expect(getShipKit('quake').flavor).toBe('geo');
  expect(getShipKit('hauler').flavor).toBe('utility');
});

test('kit hulls stay on the shared placeholder until the AD pack', () => {
  expect(KIT_HULLS_ARE_PLACEHOLDERS).toBe(true);
  const hulls = listShipKits().map((kit) => kit.hull);
  expect(hulls.every((hull) => hull === hulls[0])).toBe(true);
  expect(AD_V2_HULL_TOPOLOGY).toEqual({
    dart: 'needle',
    hauler: 'barge-hex',
    warden: 'delta-shield-arc',
    skirmisher: 'y-fork',
    quake: 'terraced-mountain',
  });
});

test('applyShipKitToShip is shared for human and bot hulls', () => {
  const ship = new Ship({ isBot: true, kitId: 'hauler' });
  expect(ship.kitId).toBe('hauler');
  expect(ship.maxHealth).toBe(140);
  applyShipKitToShip(ship, 'skirmisher');
  expect(ship.kitId).toBe('skirmisher');
  expect(ship.maxHealth).toBe(80);
});
