import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { GameEntity } from '../../../server/core/EntityManager';
import { GameEngine } from '../../../server/core/GameEngine';
import { SATELLITE } from '../../../src/constants';
import { SAUCER_HULL_COLOR } from '../../../src/entities/npc/saucerRenderHook';
import { SHIP_KIT_IDS } from '../../../src/entities/ship/shipKits';

const DAMAGE_HALF = SATELLITE.HEALTH / 2;

function firstSatellite(engine: GameEngine) {
  const satellites = engine.createSatellites(1);
  expect(satellites).not.toBeNull();
  expect(satellites!.length).toBeGreaterThan(0);
  return satellites![0]!;
}

describe('Ambient hostile NPC saucers', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    gameEngine = new GameEngine(12345);
  });

  afterEach(() => {
    gameEngine.stopGameLoop();
  });

  test('satellites appear in the authoritative game state without a summon', () => {
    const created = firstSatellite(gameEngine);
    const state = gameEngine.getGameState();

    expect(state.satellites.length).toBeGreaterThanOrEqual(SATELLITE.AMBIENT_COUNT);
    expect(created.id).toMatch(/^server-sat-/);
    expect(created.color).toBe(SAUCER_HULL_COLOR);
    expect(created.health).toBe(SATELLITE.HEALTH);
    expect(gameEngine.getDiagnostics().satellites).toBeGreaterThanOrEqual(SATELLITE.AMBIENT_COUNT);
    expect(created).not.toHaveProperty('factionId');
    expect(created).not.toHaveProperty('kitId');
  });

  test('joining a live game seeds ambient NPCs without a call-in ability', () => {
    const mockWs = {} as GameEntity['ws'];
    gameEngine.addPlayer('pilot', 'Pilot', mockWs as never, { x: 0, y: 0 });

    expect(gameEngine.getSatelliteCount()).toBeGreaterThanOrEqual(SATELLITE.AMBIENT_COUNT);
    expect(SHIP_KIT_IDS).toHaveLength(5);
    expect(SHIP_KIT_IDS).not.toContain('hook');
  });

  test('a satellite dies when shot enough times and awards score plus loot', () => {
    const satellite = firstSatellite(gameEngine);
    const mockWs = {} as GameEntity['ws'];
    gameEngine.addPlayer('pilot', 'Pilot', mockWs as never, { x: 0, y: 0 });

    const wounded = gameEngine.handleSatelliteDamage(satellite.id, 'pilot', DAMAGE_HALF);
    expect(wounded).toBe(false);
    expect(gameEngine.getSatellite(satellite.id)?.health).toBe(SATELLITE.HEALTH - DAMAGE_HALF);

    const destroyed = gameEngine.handleSatelliteDamage(satellite.id, 'pilot', DAMAGE_HALF);
    expect(destroyed).toBe(true);
    expect(gameEngine.getSatellite(satellite.id)?.exploding).toBe(true);
    expect(gameEngine.getPlayer('pilot')?.score).toBe(SATELLITE.POINTS);
    expect(gameEngine.getLoot().length).toBeGreaterThan(0);
  });

  test('a second killing shot does not award points again', () => {
    const satellite = firstSatellite(gameEngine);
    const mockWs = {} as GameEntity['ws'];
    gameEngine.addPlayer('pilot', 'Pilot', mockWs as never, { x: 0, y: 0 });
    gameEngine.handleSatelliteDamage(satellite.id, 'pilot', SATELLITE.HEALTH);
    gameEngine.handleSatelliteDamage(satellite.id, 'pilot', SATELLITE.HEALTH);
    expect(gameEngine.getPlayer('pilot')?.score).toBe(SATELLITE.POINTS);
  });

  test('satellites patrol a figure-8 and stay inside the arena', () => {
    const satellite = firstSatellite(gameEngine);
    const start = { ...satellite.position };

    for (let i = 0; i < 120; i++) {
      gameEngine.tickSatellites();
    }

    const later = gameEngine.getSatellite(satellite.id);
    expect(later).toBeDefined();
    const moved = Math.hypot(later!.position.x - start.x, later!.position.y - start.y);
    expect(moved).toBeGreaterThan(5);
    expect(Math.hypot(later!.position.x, later!.position.y)).toBeLessThan(
      SATELLITE.BOUNDARY_RADIUS + 1
    );
  });

  test('satellites shoot toward the nearest living ship regardless of faction', () => {
    const satellite = firstSatellite(gameEngine);
    const mockWs = {} as GameEntity['ws'];
    gameEngine.addPlayer('near', 'Near', mockWs as never, {
      x: satellite.position.x + 180,
      y: satellite.position.y,
    }, undefined, 'dart', 'ion');
    gameEngine.addPlayer('far', 'Far', mockWs as never, {
      x: satellite.position.x + 1800,
      y: satellite.position.y,
    }, undefined, 'warden', 'ember');

    let shots = gameEngine.drainSatelliteShots();
    for (let i = 0; i < SATELLITE.SHOOT_INTERVAL_FRAMES + 40 && shots.length === 0; i++) {
      shots = gameEngine.tickSatellites();
    }

    expect(shots.length).toBeGreaterThan(0);
    const first = shots[0]!;
    expect(Math.hypot(first.laserDirection.x, first.laserDirection.y)).toBeGreaterThan(0);
    expect(first.laserDirection.x).toBeGreaterThan(0);
  });

  test('NPCs remain hostile to every soft faction', () => {
    const satellite = firstSatellite(gameEngine);
    const mockWs = {} as GameEntity['ws'];
    const ion = gameEngine.addPlayer('ion', 'Ion', mockWs as never, { x: 0, y: 0 }, undefined, 'dart', 'ion');
    const ember = gameEngine.addPlayer(
      'ember',
      'Ember',
      mockWs as never,
      { x: 10, y: 0 },
      undefined,
      'dart',
      'ember'
    );
    ion.spawnProtectionTimer = 0;
    ember.spawnProtectionTimer = 0;

    expect(gameEngine.handlePlayerDamage(ion.id, satellite.id, 10, 'laser')).toBe(false);
    expect(gameEngine.getPlayer(ion.id)?.health).toBeLessThan(ion.maxHealth);
    expect(gameEngine.handlePlayerDamage(ember.id, satellite.id, 10, 'laser')).toBe(false);
    expect(gameEngine.getPlayer(ember.id)?.health).toBeLessThan(ember.maxHealth);
  });

  test('resetting the world clears satellites', () => {
    firstSatellite(gameEngine);
    expect(gameEngine.getSatelliteCount()).toBeGreaterThan(0);
    gameEngine.resetForTesting();
    expect(gameEngine.getSatelliteCount()).toBe(0);
    expect(gameEngine.getGameState().satellites).toEqual([]);
  });
});
