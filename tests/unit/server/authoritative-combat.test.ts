import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { WebSocketCore } from '../../../server/communication/WebSocketCore';
import { GameEngine } from '../../../server/core/GameEngine';
import type { AsteroidData } from '../../../shared-types';
import { DAMAGE, SHIP } from '../../../src/constants';

function mockWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => undefined,
  } as unknown as WebSocket;
}

function testAsteroid(overrides: Partial<AsteroidData> = {}): AsteroidData {
  return {
    id: 'server-asteroid-0',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    size: 25,
    jaggedness: 0.5,
    rotation: 0,
    angularVelocity: 0,
    health: 40,
    maxHealth: 40,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
    ...overrides,
  };
}

function clearProtection(engine: GameEngine, id: string): void {
  engine.entityManager.updateEntity(id, { spawnProtectionTimer: undefined });
}

describe('server-authoritative combat', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(12345);
  });

  afterEach(() => {
    engine.stopGameLoop();
  });

  test('overlapping human and asteroid apply one ram and destroy the roid', () => {
    engine.addPlayer('p1', 'Pilot', mockWs(), { x: 0, y: 0 });
    clearProtection(engine, 'p1');
    engine.addAsteroid(testAsteroid());

    const results = engine.resolveAuthoritativeCombat(1_000);
    const player = engine.getPlayer('p1');

    expect(results).toHaveLength(1);
    expect(results[0]?.attackerId).toBe('asteroid');
    expect(player?.health).toBe(SHIP.MAX_HEALTH - DAMAGE.LASER_HIT);
    expect(engine.getAsteroid('server-asteroid-0')).toBeUndefined();
  });

  test('player and bot share the same asteroid ram path', () => {
    const bots = engine.createBots(1);
    expect(bots).not.toBeNull();
    const bot = bots![0]!;
    engine.entityManager.updateEntity(bot.id, {
      position: { x: 10, y: 0 },
      spawnProtectionTimer: undefined,
    });
    engine.addAsteroid(testAsteroid({ id: 'server-asteroid-bot', position: { x: 10, y: 0 } }));

    engine.resolveAuthoritativeCombat(2_000);
    expect(engine.getBot(bot.id)?.health).toBe(SHIP.MAX_HEALTH - DAMAGE.LASER_HIT);
    expect(engine.getAsteroid('server-asteroid-bot')).toBeUndefined();
  });

  test('two overlapping humans take the same ship-ship tick', () => {
    engine.addPlayer('nova', 'Nova', mockWs(), { x: 0, y: 0 });
    engine.addPlayer('retro', 'Retro', mockWs(), { x: 4, y: 0 });
    clearProtection(engine, 'nova');
    clearProtection(engine, 'retro');

    const first = engine.resolveAuthoritativeCombat(10_000);
    expect(first).toHaveLength(2);
    expect(engine.getPlayer('nova')?.health).toBe(SHIP.MAX_HEALTH - 1);
    expect(engine.getPlayer('retro')?.health).toBe(SHIP.MAX_HEALTH - 1);

    expect(engine.resolveAuthoritativeCombat(10_049)).toHaveLength(0);
    expect(engine.getPlayer('nova')?.health).toBe(SHIP.MAX_HEALTH - 1);

    const second = engine.resolveAuthoritativeCombat(10_050);
    expect(second).toHaveLength(2);
    expect(engine.getPlayer('nova')?.health).toBe(SHIP.MAX_HEALTH - 2);
    expect(engine.getPlayer('retro')?.health).toBe(SHIP.MAX_HEALTH - 2);
  });

  test('spawn protection blocks server ram for humans', () => {
    engine.addPlayer('p1', 'Pilot', mockWs(), { x: 0, y: 0 });
    engine.addAsteroid(testAsteroid());

    engine.resolveAuthoritativeCombat(3_000);
    expect(engine.getPlayer('p1')?.health).toBe(SHIP.MAX_HEALTH);
    expect(engine.getAsteroid('server-asteroid-0')).toBeDefined();
  });

  test('client asteroid and ship-ship reports are ignored', () => {
    const wsCore = new WebSocketCore(engine);
    const novaWs = mockWs();
    const retroWs = mockWs();
    wsCore.handleClientMessage(
      { type: 'join', data: { id: 'nova', name: 'Nova', position: { x: 80, y: 80 } } },
      novaWs
    );
    wsCore.handleClientMessage(
      { type: 'join', data: { id: 'retro', name: 'Retro', position: { x: 200, y: 200 } } },
      retroWs
    );
    clearProtection(engine, 'nova');
    clearProtection(engine, 'retro');

    wsCore.handleClientMessage(
      {
        type: 'collisionDamage',
        data: { targetPlayerId: 'nova', attackerId: 'asteroid', damage: 25 },
      },
      novaWs
    );
    wsCore.handleClientMessage(
      {
        type: 'collisionDamage',
        data: { targetPlayerId: 'nova', attackerId: 'retro', damage: 1 },
      },
      novaWs
    );
    wsCore.handleClientMessage(
      {
        type: 'collisionDamage',
        data: { targetPlayerId: 'retro', attackerId: 'asteroid', damage: 25 },
      },
      retroWs
    );

    expect(engine.getPlayer('nova')?.health).toBe(SHIP.MAX_HEALTH);
    expect(engine.getPlayer('retro')?.health).toBe(SHIP.MAX_HEALTH);
  });

  test('validated laserDamage is the only client path that chips a remote human', () => {
    const wsCore = new WebSocketCore(engine);
    const novaWs = mockWs();
    const retroWs = mockWs();
    wsCore.handleClientMessage(
      { type: 'join', data: { id: 'nova', name: 'Nova', position: { x: 0, y: 0 } } },
      novaWs
    );
    wsCore.handleClientMessage(
      { type: 'join', data: { id: 'retro', name: 'Retro', position: { x: 30, y: 0 } } },
      retroWs
    );
    clearProtection(engine, 'nova');
    clearProtection(engine, 'retro');

    wsCore.handleClientMessage(
      {
        type: 'laserDamage',
        data: { targetPlayerId: 'retro', attackerId: 'nova', damage: 1000 },
      },
      novaWs
    );
    expect(engine.getPlayer('retro')?.health).toBe(SHIP.MAX_HEALTH - DAMAGE.LASER_HIT);

    wsCore.handleClientMessage(
      {
        type: 'laserDamage',
        data: { targetPlayerId: 'nova', attackerId: 'nova', damage: 25 },
      },
      retroWs
    );
    expect(engine.getPlayer('nova')?.health).toBe(SHIP.MAX_HEALTH);
  });

  test('boundary collisionDamage still applies when the reporter is the target', () => {
    const wsCore = new WebSocketCore(engine);
    const novaWs = mockWs();
    wsCore.handleClientMessage(
      { type: 'join', data: { id: 'nova', name: 'Nova', position: { x: 0, y: 0 } } },
      novaWs
    );
    clearProtection(engine, 'nova');

    wsCore.handleClientMessage(
      {
        type: 'collisionDamage',
        data: { targetPlayerId: 'nova', attackerId: 'boundary', damage: 100 },
      },
      novaWs
    );

    expect(engine.getPlayer('nova')?.health).toBe(0);
    expect(engine.getPlayer('nova')?.lives).toBe(2);
  });
});
