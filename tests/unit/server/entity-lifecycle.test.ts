/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { MessageHandler } from '../../../server/communication/MessageHandler';
import {
  COMBAT_REWARDS,
  LIFECYCLE,
  hasActiveSpawnProtection,
  isCombatInvulnerable,
  isStaleDeathPose,
  isUnavailableForClientMovement,
  shouldAcceptClientMovement,
} from '../../../server/core/entityLifecycle';
import { GameEngine } from '../../../server/core/GameEngine';
import { GameStateBroadcaster } from '../../../server/services/GameStateBroadcaster';
import { DEBUG, SHIP } from '../../../src/constants';
import type { AsteroidData } from '../../../shared-types';

function mockWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => undefined,
  } as unknown as WebSocket;
}

function clearSpawnShield(engine: GameEngine, id: string): void {
  engine.entityManager.updateEntity(id, { spawnProtectionTimer: undefined });
}

function expectRespawned(ship: ReturnType<GameEngine['getEntity']>): void {
  expect(ship?.health).toBe(ship?.maxHealth);
  expect(ship?.respawnTimer).toBeUndefined();
  expect(ship?.exploding).toBe(false);
  expect(ship?.spawnProtectionTimer).toBe(LIFECYCLE.spawnProtectionFrames);
  expect(ship?.respawnAnchor).toEqual(ship?.position);
}

function firstBot(engine: GameEngine) {
  const bots = engine.createBots(1);
  expect(bots).not.toBeNull();
  const bot = bots![0];
  expect(bot).toBeDefined();
  clearSpawnShield(engine, bot!.id);
  return bot!;
}

describe('entity lifecycle status checks', () => {
  test('combat invulnerability is the same for humans and bots', () => {
    const base = {
      type: 'human' as const,
      exploding: false,
      health: 100,
      lives: 3,
    };

    expect(isCombatInvulnerable(base)).toBe(false);
    expect(isCombatInvulnerable({ ...base, exploding: true })).toBe(true);
    expect(isCombatInvulnerable({ ...base, health: 0 })).toBe(true);
    expect(isCombatInvulnerable({ ...base, respawnTimer: 12 })).toBe(true);
    expect(isCombatInvulnerable({ ...base, spawnProtectionTimer: 10 })).toBe(true);

    const bot = { ...base, type: 'bot' as const };
    expect(isCombatInvulnerable(bot)).toBe(false);
    expect(isCombatInvulnerable({ ...bot, exploding: true })).toBe(true);
    expect(isCombatInvulnerable({ ...bot, health: 0 })).toBe(true);
    expect(isCombatInvulnerable({ ...bot, respawnTimer: 12 })).toBe(true);
    expect(hasActiveSpawnProtection({ type: 'bot', spawnProtectionTimer: 10 })).toBe(
      DEBUG.BOT_PLAYER.SPAWN_PROTECTION
    );
  });

  test('client movement is blocked while exploding, dead, or respawning', () => {
    const alive = {
      type: 'human' as const,
      exploding: false,
      health: 100,
      lives: 3,
    };
    expect(isUnavailableForClientMovement(alive)).toBe(false);
    expect(isUnavailableForClientMovement({ ...alive, exploding: true })).toBe(true);
    expect(isUnavailableForClientMovement({ ...alive, health: 0 })).toBe(true);
    expect(isUnavailableForClientMovement({ ...alive, respawnTimer: 1 })).toBe(true);
  });

  test('stale death-pose updates are rejected until the client echoes the spawn', () => {
    const anchor = { x: 10, y: 10 };
    expect(isStaleDeathPose(anchor, { x: 3100, y: 0 })).toBe(true);
    expect(isStaleDeathPose(anchor, { x: 10, y: 10 })).toBe(false);
    expect(
      shouldAcceptClientMovement(
        {
          type: 'human',
          exploding: false,
          health: 100,
          lives: 3,
          respawnAnchor: anchor,
        },
        { x: 3100, y: 0 }
      )
    ).toBe(false);
    expect(
      shouldAcceptClientMovement(
        {
          type: 'human',
          exploding: false,
          health: 100,
          lives: 3,
          respawnAnchor: anchor,
        },
        { x: 10, y: 10 }
      )
    ).toBe(true);
  });
});

describe('shared player and bot explosion → respawn → spawn protection', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(12345);
  });

  afterEach(() => {
    engine.stopGameLoop();
  });

  test('human kill schedules respawn immediately and explosion does not reset it', () => {
    const player = engine.addPlayer('p1', 'Pilot', mockWs(), { x: 0, y: 0 });
    clearSpawnShield(engine, 'p1');

    const destroyed = engine.handlePlayerDamage('p1', 'boundary', player.health);
    expect(destroyed).toBe(true);

    const afterDeath = engine.getPlayer('p1');
    expect(afterDeath?.exploding).toBe(true);
    expect(afterDeath?.explodeTime).toBe(LIFECYCLE.explodeFrames);
    expect(afterDeath?.respawnTimer).toBe(LIFECYCLE.respawnFrames);
    expect(afterDeath?.lives).toBe(2);

    for (let i = 0; i < LIFECYCLE.explodeFrames; i++) {
      engine.tickWorld();
    }

    const afterExplosion = engine.getPlayer('p1');
    expect(afterExplosion?.exploding).toBe(false);
    expect(afterExplosion?.health).toBe(0);
    expect(afterExplosion?.respawnTimer).toBe(
      LIFECYCLE.respawnFrames - LIFECYCLE.explodeFrames
    );
  });

  test('bot kill waits for explosion end to start the same respawn countdown', () => {
    const bot = firstBot(engine);
    const livesBefore = bot.lives;

    expect(engine.handleBotDamage(bot.id, 'asteroid', bot.health)).toBe(true);
    const afterDeath = engine.getBot(bot.id);
    expect(afterDeath?.exploding).toBe(true);
    expect(afterDeath?.respawnTimer).toBeUndefined();
    expect(afterDeath?.lives).toBe(livesBefore);
    expect(afterDeath?.health).toBe(0);

    for (let i = 0; i < LIFECYCLE.explodeFrames; i++) {
      engine.entityManager.updateExplosions();
    }

    const afterExplosion = engine.getBot(bot.id);
    expect(afterExplosion?.exploding).toBe(false);
    expect(afterExplosion?.health).toBe(0);
    expect(afterExplosion?.respawnTimer).toBe(LIFECYCLE.respawnFrames);

    engine.tickWorld();
    expect(engine.getBot(bot.id)?.respawnTimer).toBe(LIFECYCLE.respawnFrames - 1);
  });

  test('respawn restores hull, arms protection, and holds an anchor for both kinds', () => {
    const player = engine.addPlayer('p1', 'Pilot', mockWs(), { x: 3100, y: 0 });
    clearSpawnShield(engine, 'p1');
    engine.handlePlayerDamage('p1', 'asteroid', player.health);
    for (let i = 0; i < LIFECYCLE.respawnFrames; i++) {
      engine.tickWorld();
    }
    expectRespawned(engine.getPlayer('p1'));

    const fresh = new GameEngine(54321);
    const bot = firstBot(fresh);
    fresh.handleBotDamage(bot.id, 'asteroid', bot.health);
    // tickWorld decrements the respawn timer on the explosion-complete frame.
    for (let i = 0; i < LIFECYCLE.explodeFrames + LIFECYCLE.respawnFrames - 1; i++) {
      fresh.tickWorld();
    }
    expectRespawned(fresh.getBot(bot.id));
  });

  test('handleTargetDamage routes player and bot scoring rules', () => {
    engine.addPlayer('attacker', 'Gunner', mockWs());
    const victim = engine.addPlayer('victim', 'Target', mockWs());
    clearSpawnShield(engine, 'attacker');
    clearSpawnShield(engine, 'victim');
    const bot = firstBot(engine);

    expect(engine.handleTargetDamage('victim', 'attacker', victim.health)).toBe(true);
    expect(engine.getPlayer('attacker')?.score).toBe(COMBAT_REWARDS.playerKill);

    expect(engine.handleTargetDamage(bot.id, 'attacker', bot.health)).toBe(true);
    expect(engine.getPlayer('attacker')?.score).toBe(
      COMBAT_REWARDS.playerKill + COMBAT_REWARDS.botKill
    );
  });

  test('ignored hits stay ignored while respawning or shielded', () => {
    const player = engine.addPlayer('p1', 'Pilot', mockWs());
    expect(engine.handlePlayerDamage('p1', 'roid', 25)).toBe(false);
    expect(engine.getPlayer('p1')?.health).toBe(SHIP.MAX_HEALTH);

    clearSpawnShield(engine, 'p1');
    engine.handlePlayerDamage('p1', 'roid', player.health);
    expect(engine.handlePlayerDamage('p1', 'roid', 25)).toBe(false);
    expect(engine.getPlayer('p1')?.health).toBe(0);
  });
});

describe('safer gameState snapshots', () => {
  test('mutating a snapshot does not move live ships or asteroids', () => {
    const engine = new GameEngine(99);
    const player = engine.addPlayer('p1', 'Pilot', mockWs(), { x: 40, y: 50 });
    const asteroid: AsteroidData = {
      id: 'roid-1',
      position: { x: 8, y: 9 },
      velocity: { x: 1, y: 2 },
      size: 40,
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 20,
      maxHealth: 20,
      vertices: 6,
      offsets: [1, 2, 3, 4, 5, 6],
    };
    engine.addAsteroid(asteroid);

    const snapshot = engine.getGameState();
    const entity = snapshot.entities.find((item) => item.id === 'p1');
    expect(entity).toBeDefined();
    entity!.position.x = 999;
    entity!.velocity.y = 999;
    snapshot.asteroids[0]!.position.x = 777;
    snapshot.asteroids[0]!.offsets[0] = 42;

    expect(player.position).toEqual({ x: 40, y: 50 });
    expect(engine.getAsteroid('roid-1')?.position).toEqual({ x: 8, y: 9 });
    expect(engine.getAsteroid('roid-1')?.offsets[0]).toBe(1);
  });
});

describe('MessageHandler defers lifecycle to GameEngine', () => {
  test('update is ignored while exploding and after a stale death pose', () => {
    const engine = new GameEngine(7);
    const sent: string[] = [];
    const ws = {
      readyState: WebSocket.OPEN,
      send: (payload: string) => {
        sent.push(payload);
      },
    } as unknown as WebSocket;
    const handler = new MessageHandler(engine, new GameStateBroadcaster(engine));

    const spectatorWs = {
      readyState: WebSocket.OPEN,
      send: (payload: string) => {
        sent.push(payload);
      },
    } as unknown as WebSocket;
    engine.addPlayer('p1', 'Pilot', ws, { x: 0, y: 0 });
    engine.addPlayer('p2', 'Spectator', spectatorWs, { x: 10, y: 10 });
    clearSpawnShield(engine, 'p1');
    engine.handlePlayerDamage('p1', 'boundary', SHIP.MAX_HEALTH);

    handler.handleMessage(
      { type: 'update', id: 'p1', position: { x: 500, y: 500 }, angle: 1 },
      ws
    );
    expect(engine.getPlayer('p1')?.position).toEqual({ x: 0, y: 0 });

    for (let i = 0; i < LIFECYCLE.respawnFrames; i++) {
      engine.tickWorld();
    }
    const respawned = engine.getPlayer('p1');
    expect(respawned?.respawnAnchor).toEqual(respawned?.position);
    const spawn = { ...respawned!.position };

    handler.handleMessage(
      { type: 'update', id: 'p1', position: { x: 3100, y: 0 }, angle: 0 },
      ws
    );
    expect(engine.getPlayer('p1')?.position).toEqual(spawn);
    expect(engine.getPlayer('p1')?.respawnAnchor).toEqual(spawn);

    handler.handleMessage({ type: 'update', id: 'p1', position: spawn, angle: 0.2 }, ws);
    expect(engine.getPlayer('p1')?.respawnAnchor).toBeUndefined();
    expect(engine.getPlayer('p1')?.angle).toBe(0.2);
    expect(sent.some((raw) => JSON.parse(raw).type === 'playerUpdate')).toBe(true);
  });
});
