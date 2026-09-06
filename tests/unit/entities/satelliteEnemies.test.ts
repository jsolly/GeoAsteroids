import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GameEngine } from '../../../server/core/GameEngine';
import { SATELLITE } from '../../../src/constants';
import type { GameEntity } from '../../../server/core/EntityManager';

vi.mock('../../setup/serverLogger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const DAMAGE_HALF = SATELLITE.HEALTH / 2;

function firstSatellite(engine: GameEngine) {
  const satellites = engine.createSatellites(1);
  expect(satellites).not.toBeNull();
  expect(satellites!.length).toBeGreaterThan(0);
  return satellites![0]!;
}

describe('Satellite enemies', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    gameEngine = new GameEngine(12345);
  });

  afterEach(() => {
    gameEngine.stopGameLoop();
    vi.clearAllMocks();
  });

  test('satellites appear in the authoritative game state', () => {
    const created = firstSatellite(gameEngine);
    const state = gameEngine.getGameState();

    expect(state.satellites).toHaveLength(2);
    expect(created.id).toMatch(/^server-sat-/);
    expect(created.color.toLowerCase()).not.toBe('#ffffff');
    expect(created.health).toBe(SATELLITE.HEALTH);
    expect(gameEngine.getDiagnostics().satellites).toBe(2);
  });

  test('a satellite dies when shot enough times and awards points', () => {
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

  test('satellites shoot toward the nearest living ship', () => {
    const satellite = firstSatellite(gameEngine);
    const mockWs = {} as GameEntity['ws'];
    gameEngine.addPlayer('near', 'Near', mockWs as never, {
      x: satellite.position.x + 180,
      y: satellite.position.y,
    });
    gameEngine.addPlayer('far', 'Far', mockWs as never, {
      x: satellite.position.x + 1800,
      y: satellite.position.y,
    });

    let shots = gameEngine.drainSatelliteShots();
    for (let i = 0; i < SATELLITE.SHOOT_INTERVAL_FRAMES + 40 && shots.length === 0; i++) {
      shots = gameEngine.tickSatellites();
    }

    expect(shots.length).toBeGreaterThan(0);
    const first = shots[0]!;
    expect(Math.hypot(first.laserDirection.x, first.laserDirection.y)).toBeGreaterThan(0);
    expect(first.laserDirection.x).toBeGreaterThan(0);
  });

  test('resetting the world clears satellites', () => {
    firstSatellite(gameEngine);
    expect(gameEngine.getSatelliteCount()).toBeGreaterThan(0);
    gameEngine.resetForTesting();
    expect(gameEngine.getSatelliteCount()).toBe(0);
    expect(gameEngine.getGameState().satellites).toEqual([]);
  });
});
