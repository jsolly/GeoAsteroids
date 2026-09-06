import { expect, test } from 'vitest';
import {
  absorbDamageWithShield,
  activateAbilityOnHost,
  applySharedHarpoonLatch,
  applyShockPulse,
  canActivateAbility,
  findHarpoonTarget,
  pullHarpoonTarget,
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
    harpoonTimer: 0,
  };
}

test('Dart boost dash adds forward velocity', () => {
  const dart = host('dart');
  const result = activateAbilityOnHost(dart);
  expect(result.activated).toBe(true);
  expect(result.abilityId).toBe('boostDash');
  expect(dart.velocity.x).toBeCloseTo(SHIP_ABILITY.DASH_BOOST);
  expect(canActivateAbility(dart)).toBe(false);
  expect(dart.harpoonTimer).toBe(0);
});

test('Hauler harpoon latches one rock and hauls only that rock', () => {
  const hauler = host('hauler');
  const near = { id: 'near-rock', position: { x: 80, y: 0 }, velocity: { x: 0, y: 0 } };
  const far = { id: 'far-rock', position: { x: 200, y: 0 }, velocity: { x: 0, y: 0 } };
  const result = activateAbilityOnHost(hauler, { asteroids: [near, far], entities: [] });
  expect(result.activated).toBe(true);
  expect(result.abilityId).toBe('harpoon');
  expect(hauler.harpoonTargetId).toBe('near-rock');
  expect(hauler.harpoonTimer).toBe(SHIP_ABILITY.HARPOON_FRAMES);
  pullHarpoonTarget(hauler, [near, far]);
  expect(near.velocity.x).toBeLessThan(0);
  expect(far.velocity.x).toBe(0);
});

test('harpoon prefers a forward rock over a nearer rock behind the Hauler', () => {
  const hauler = host('hauler');
  hauler.angle = 0;
  const behind = { id: 'behind', position: { x: -40, y: 0 }, velocity: { x: 0, y: 0 } };
  const ahead = { id: 'ahead', position: { x: 90, y: 0 }, velocity: { x: 0, y: 0 } };
  expect(findHarpoonTarget(hauler, [behind, ahead])?.id).toBe('ahead');
});

test('non-Hauler kits never latch or haul', () => {
  const dart = host('dart');
  const rock = { id: 'rock', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } };
  activateAbilityOnHost(dart, { asteroids: [rock], entities: [] });
  expect(dart.harpoonTargetId).toBeUndefined();
  dart.harpoonTimer = 90;
  dart.harpoonTargetId = 'rock';
  dart.kitId = 'dart';
  pullHarpoonTarget(dart, [rock]);
  expect(rock.velocity.x).toBe(0);
  expect(dart.harpoonTimer).toBe(0);
});

test('Hauler harpoon whiffs without a rock in range', () => {
  const hauler = host('hauler');
  const result = activateAbilityOnHost(hauler, { asteroids: [], entities: [] });
  expect(result.activated).toBe(false);
  expect(hauler.abilityCooldownFrames).toBe(0);
  expect(hauler.harpoonTimer).toBe(0);
});

test('Hauler harpoon latches a nearby ship and hauls only that ship', () => {
  const hauler = host('hauler');
  hauler.id = 'hauler-1';
  const near = { id: 'dart-1', position: { x: 80, y: 0 }, velocity: { x: 0, y: 0 }, health: 100 };
  const far = { id: 'dart-2', position: { x: 200, y: 0 }, velocity: { x: 0, y: 0 }, health: 100 };
  const result = activateAbilityOnHost(hauler, { asteroids: [], entities: [near, far] });
  expect(result.activated).toBe(true);
  expect(hauler.harpoonTargetId).toBe('dart-1');
  pullHarpoonTarget(hauler, [near, far]);
  expect(near.velocity.x).toBeLessThan(0);
  expect(far.velocity.x).toBe(0);
});

test('harpoon prefers a forward ship over a nearer rock behind the Hauler', () => {
  const hauler = host('hauler');
  hauler.id = 'hauler-1';
  hauler.angle = 0;
  const rockBehind = { id: 'rock', position: { x: -40, y: 0 }, velocity: { x: 0, y: 0 } };
  const shipAhead = {
    id: 'foe',
    position: { x: 90, y: 0 },
    velocity: { x: 0, y: 0 },
    health: 100,
  };
  expect(findHarpoonTarget(hauler, [rockBehind, shipAhead])?.id).toBe('foe');
});

test('harpoon skips self, same-side mates, and a Warden shield', () => {
  const hauler = host('hauler');
  hauler.id = 'hauler-1';
  hauler.factionId = 'ion';
  const self = { id: 'hauler-1', position: { x: 30, y: 0 }, velocity: { x: 0, y: 0 }, health: 100 };
  const mate = {
    id: 'mate',
    position: { x: 40, y: 0 },
    velocity: { x: 0, y: 0 },
    factionId: 'ion' as const,
    health: 100,
  };
  const shielded = {
    id: 'warden',
    position: { x: 50, y: 0 },
    velocity: { x: 0, y: 0 },
    factionId: 'ember' as const,
    health: 100,
    shieldTimer: 40,
  };
  const foe = {
    id: 'foe',
    position: { x: 90, y: 0 },
    velocity: { x: 0, y: 0 },
    factionId: 'ember' as const,
    health: 100,
  };
  expect(findHarpoonTarget(hauler, [self, mate, shielded, foe])?.id).toBe('foe');
});

test('harpoon skips a timed ship shield', () => {
  const hauler = host('hauler');
  hauler.id = 'hauler-1';
  const shielded = {
    id: 'dart-1',
    position: { x: 50, y: 0 },
    velocity: { x: 0, y: 0 },
    health: 100,
    shieldActive: true,
  };
  const foe = { id: 'dart-2', position: { x: 90, y: 0 }, velocity: { x: 0, y: 0 }, health: 100 };
  expect(findHarpoonTarget(hauler, [shielded, foe])?.id).toBe('dart-2');
});

test('local and remote adopt the same server latch', () => {
  const local = host('hauler');
  applySharedHarpoonLatch(local, { harpoonTimer: 80, harpoonTargetId: 'bot-1' }, 'predicting');
  expect(local.harpoonTargetId).toBe('bot-1');
  expect(local.harpoonTimer).toBe(80);
  applySharedHarpoonLatch(local, { harpoonTimer: 0 }, 'predicting');
  expect(local.harpoonTimer).toBe(80);
  expect(local.harpoonTargetId).toBe('bot-1');

  const remote = host('hauler');
  remote.harpoonTimer = 40;
  remote.harpoonTargetId = 'old';
  applySharedHarpoonLatch(remote, { harpoonTimer: 80, harpoonTargetId: 'bot-1' }, 'authoritative');
  expect(remote.harpoonTargetId).toBe('bot-1');
  applySharedHarpoonLatch(remote, { harpoonTimer: 0 }, 'authoritative');
  expect(remote.harpoonTimer).toBe(0);
  expect(remote.harpoonTargetId).toBeUndefined();
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
