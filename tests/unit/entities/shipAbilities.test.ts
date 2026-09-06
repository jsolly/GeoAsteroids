import { expect, test } from 'vitest';
import {
  absorbDamageWithShield,
  activateAbilityOnHost,
  applyShockPulse,
  canActivateAbility,
  pullMagnetTargets,
  tickAbilityHost,
  type AbilityHost,
} from '../../../src/entities/ship/shipAbilities';
import { SHIP_ABILITY } from '../../../src/entities/ship/shipKits';
import { Ship } from '../../../src/entities/ship/Ship';

function host(kitId: AbilityHost['kitId']): AbilityHost {
  return {
    kitId,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    exploding: false,
    health: 100,
    abilityCooldownFrames: 0,
    abilityActiveFrames: 0,
    shieldTimer: 0,
    magnetTimer: 0,
  };
}

test('Dart boost dash adds forward velocity', () => {
  const dart = host('dart');
  const result = activateAbilityOnHost(dart);
  expect(result.activated).toBe(true);
  expect(result.abilityId).toBe('boostDash');
  expect(dart.velocity.x).toBeCloseTo(SHIP_ABILITY.DASH_BOOST);
  expect(canActivateAbility(dart)).toBe(false);
});

test('Hauler loot magnet pulls nearby rocks', () => {
  const hauler = host('hauler');
  activateAbilityOnHost(hauler);
  expect(hauler.magnetTimer).toBe(SHIP_ABILITY.MAGNET_FRAMES);
  const rock = { position: { x: 80, y: 0 }, velocity: { x: 0, y: 0 } };
  pullMagnetTargets(hauler, [rock]);
  expect(rock.velocity.x).toBeLessThan(0);
});

test('Warden shield absorbs a hit', () => {
  const warden = host('warden');
  activateAbilityOnHost(warden);
  expect(absorbDamageWithShield(warden)).toBe(true);
  const ship = new Ship({ kitId: 'warden' });
  ship.activateAbility();
  const before = ship.health;
  ship.takeDamage(25);
  expect(ship.health).toBe(before);
});

test('Skirmisher burst marks a volley and the ship fires three lasers', () => {
  const skirmisher = host('skirmisher');
  const result = activateAbilityOnHost(skirmisher);
  expect(result.abilityId).toBe('burstFire');
  const ship = new Ship({ kitId: 'skirmisher' });
  ship.activateAbility();
  expect(ship.lasers.length).toBe(3);
});

test('Quake shock pulse knocks nearby rocks and ships without terrain', () => {
  const quake = host('quake');
  const rock = { position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } };
  const other = { position: { x: -40, y: 0 }, velocity: { x: 0, y: 0 } };
  const result = activateAbilityOnHost(quake, { asteroids: [rock], entities: [other] });
  expect(result.abilityId).toBe('shockPulse');
  expect(rock.velocity.x).toBeGreaterThan(0);
  expect(other.velocity.x).toBeLessThan(0);
  applyShockPulse(quake, { asteroids: [], entities: [] });
});

test('ability cooldown ticks down', () => {
  const dart = host('dart');
  activateAbilityOnHost(dart);
  const start = dart.abilityCooldownFrames;
  tickAbilityHost(dart);
  expect(dart.abilityCooldownFrames).toBe(start - 1);
});
