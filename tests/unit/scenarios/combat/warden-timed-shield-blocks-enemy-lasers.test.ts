import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DAMAGE } from '../../../../src/constants';
import { SHIP_ABILITY } from '../../../../src/entities/ship/shipKits';
import { shieldDurationFrames } from '../../../../src/entities/ship/shipShield';
import {
  GameServerWorld,
  useQuietServerConsole,
  type Pilot,
} from '../support/gameServerWorld';

useQuietServerConsole();

describe('A Warden raises a timed shield that blocks enemy lasers', () => {
  let world: GameServerWorld;
  let warden: Pilot;
  let foe: Pilot;
  let mate: Pilot;

  beforeEach(() => {
    world = new GameServerWorld();
  });

  afterEach(() => {
    world.dispose();
  });

  test('F-key bubble blocks an opposite-side laser and flashes', () => {
    warden = world.join('Warden', { x: 0, y: 0 }, { kitId: 'warden', factionId: 'ember' });
    foe = world.join('Foe', { x: 80, y: 0 }, { kitId: 'dart', factionId: 'ion' });
    world.parkBots();
    world.engine.entityManager.updateEntity(warden.id, { spawnProtectionTimer: undefined });

    expect(world.engine.requestShield(warden.id, true)).toBe(true);
    const health = world.entity(warden).health;

    world.engine.handlePlayerDamage(warden.id, foe.id, DAMAGE.LASER_HIT, 'laser');
    expect(world.entity(warden).health).toBe(health);
    expect(world.entity(warden).shieldActive).toBe(true);
    expect(world.entity(warden).shieldFlashTime).toBeGreaterThan(0);
  });

  test('kit E raises the same readable shield fields as F', () => {
    warden = world.join('Warden', { x: 0, y: 0 }, { kitId: 'warden', factionId: 'ember' });
    world.parkBots();

    world.send(warden, {
      type: 'useAbility',
      id: warden.id,
      data: { kitId: 'warden', abilityId: 'shieldFocus' },
    });

    const ship = world.entity(warden);
    expect(ship.kitId).toBe('warden');
    expect(ship.shieldTimer).toBe(SHIP_ABILITY.SHIELD_FRAMES);
    expect(ship.shieldActive).toBe(true);
    expect(ship.shieldTime).toBe(SHIP_ABILITY.SHIELD_FRAMES);
  });

  test('same-side lasers skip damage and leave the ring quiet', () => {
    warden = world.join('Warden', { x: 0, y: 0 }, { kitId: 'warden', factionId: 'ion' });
    mate = world.join('Mate', { x: 80, y: 0 }, { kitId: 'dart', factionId: 'ion' });
    world.parkBots();
    world.engine.entityManager.updateEntity(warden.id, { spawnProtectionTimer: undefined });
    expect(world.engine.requestShield(warden.id, true)).toBe(true);

    const health = world.entity(warden).health;
    world.engine.handlePlayerDamage(warden.id, mate.id, DAMAGE.LASER_HIT, 'laser');
    expect(world.entity(warden).health).toBe(health);
    expect(world.entity(warden).shieldFlashTime).toBe(0);
  });

  test('after the bubble expires an enemy laser cuts health', () => {
    warden = world.join('Warden', { x: 0, y: 0 }, { kitId: 'dart', factionId: 'ember' });
    foe = world.join('Foe', { x: 80, y: 0 }, { kitId: 'dart', factionId: 'ion' });
    world.parkBots();
    world.engine.entityManager.updateEntity(warden.id, { spawnProtectionTimer: undefined });
    expect(world.engine.requestShield(warden.id, true)).toBe(true);

    for (let i = 0; i < shieldDurationFrames(); i++) {
      world.engine.entityManager.updateShields();
    }

    expect(world.entity(warden).shieldActive).toBe(false);
    const health = world.entity(warden).health;
    world.engine.handlePlayerDamage(warden.id, foe.id, DAMAGE.LASER_HIT, 'laser');
    expect(world.entity(warden).health).toBe(health - DAMAGE.LASER_HIT);
  });
});
