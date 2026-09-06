import { describe, expect, test } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { EntityManager } from '../../../server/core/EntityManager';
import { GameEngine } from '../../../server/core/GameEngine';
import { RNGService } from '../../../server/core/RNGService';
import { SHIP, SPAWN } from '../../../src/constants';
import { isOnPlayfieldCanvas } from '../../../src/physics/asteroidMotion';
import {
  containShipUnlessPastKillWall,
  getPlayVolumeRadius,
  getShipSpawnRadius,
  randomShipSpawnPosition,
} from '../../../src/physics/playVolume';
import { move } from '../../../src/entities/ship/ShipMovementManager';

const SMALL_CANVAS = SPAWN.CONSERVATIVE_CANVAS;
const HD_CANVAS = { width: 1920, height: 1080 };

function rocksOnCanvas(
  asteroids: Array<{ position: { x: number; y: number } }>,
  ship: { x: number; y: number },
  canvas: { width: number; height: number }
): number {
  return asteroids.filter((asteroid) => isOnPlayfieldCanvas(asteroid.position, ship, canvas)).length;
}

describe('play volume keeps canvas rocks matching the radar belt', () => {
  test('spawn and respawn stay inside the inner disk, not the 3100 arena', () => {
    const manager = new EntityManager(new RNGService(99));
    const ws = {} as never;
    for (let i = 0; i < 40; i++) {
      const player = manager.addHumanPlayer(`p-${i}`, `Pilot${i}`, ws, { x: 3100, y: 0 });
      player.respawnTimer = 0;
      manager.updateRespawns();
      const respawned = manager.getEntity(`p-${i}`);
      expect(Math.hypot(respawned!.position.x, respawned!.position.y)).toBeLessThanOrEqual(
        getShipSpawnRadius() + 1
      );
      expect(
        Math.hypot(respawned!.position.x - 3100, respawned!.position.y)
      ).toBeGreaterThan(SPAWN.MIN_RESPAWN_SEPARATION - 1);
    }
  });

  test('bots spawn inside the same disk as humans', () => {
    const manager = new EntityManager(new RNGService(3));
    const bots = manager.createBots(2);
    expect(bots.length).toBeGreaterThan(0);
    for (const bot of bots) {
      expect(Math.hypot(bot.position.x, bot.position.y)).toBeLessThanOrEqual(
        getShipSpawnRadius() + 1
      );
    }
  });

  test('a ship thrusting for 70s stays in the belt unless it is past the kill wall', () => {
    const state = {
      position: { x: 40, y: -20 },
      velocity: { x: SHIP.MAX_VELOCITY, y: 0 },
      angle: 0,
      angularVelocity: 0,
      thrusting: true,
      thrusterActive: false,
      frictionCoefficient: 0,
    };
    for (let i = 0; i < 70 * 60; i++) {
      move(state);
    }
    expect(Math.hypot(state.position.x, state.position.y)).toBeLessThanOrEqual(
      getPlayVolumeRadius() + 1
    );

    const pastWall = containShipUnlessPastKillWall({ x: 3200, y: 0 }, { x: 8, y: 0 });
    expect(pastWall.position).toEqual({ x: 3200, y: 0 });
    expect(pastWall.velocity).toEqual({ x: 8, y: 0 });
  });

  test('after 70s the belt stays on an 800×600 canvas from spawn and respawn poses', () => {
    const asteroids = new AsteroidManager(new RNGService(11));
    asteroids.createAsteroids(20);
    for (let i = 0; i < 70 * 60; i++) {
      asteroids.updateMotion();
    }
    const field = asteroids.getAllAsteroids();
    expect(field.length).toBeGreaterThan(0);
    for (const asteroid of field) {
      expect(Math.hypot(asteroid.position.x, asteroid.position.y)).toBeLessThanOrEqual(
        getPlayVolumeRadius() + 1
      );
    }

    const ships = [
      { x: 0, y: 0 },
      randomShipSpawnPosition(() => 0.25),
      randomShipSpawnPosition(() => 0.8),
      { x: getShipSpawnRadius(), y: 0 },
      { x: 0, y: -getShipSpawnRadius() },
    ];
    for (const ship of ships) {
      expect(
        rocksOnCanvas(field, ship, SMALL_CANVAS),
        `800×600 ship at ${ship.x},${ship.y} should see belt rocks`
      ).toBeGreaterThan(0);
      expect(rocksOnCanvas(field, ship, HD_CANVAS)).toBeGreaterThan(0);
    }

    const rimGhost = { x: 2000, y: 1500 };
    expect(
      rocksOnCanvas(field, rimGhost, SMALL_CANVAS),
      'a 3100-arena respawn must not be how we place ships — that view is empty'
    ).toBe(0);
  });

  test('two spawn-disk ships both see the same 70s field on a small canvas', () => {
    const asteroids = new AsteroidManager(new RNGService(21));
    asteroids.createAsteroids(20);
    for (let i = 0; i < 70 * 60; i++) {
      asteroids.updateMotion();
    }
    const field = asteroids.getAllAsteroids();
    const a = randomShipSpawnPosition(() => 0.1);
    const b = randomShipSpawnPosition(() => 0.9);
    expect(rocksOnCanvas(field, a, SMALL_CANVAS)).toBeGreaterThan(0);
    expect(rocksOnCanvas(field, b, SMALL_CANVAS)).toBeGreaterThan(0);
  });
});

describe('live #444 pose would empty a small canvas', () => {
  test('a ship at the old 1145/1475 radar-only poses sees no 800×600 rocks after 70s', () => {
    const asteroids = new AsteroidManager(new RNGService(11));
    asteroids.createAsteroids(20);
    for (let i = 0; i < 70 * 60; i++) {
      asteroids.updateMotion();
    }
    const field = asteroids.getAllAsteroids();
    expect(rocksOnCanvas(field, { x: 326, y: -1098 }, SMALL_CANVAS)).toBe(0);
    expect(rocksOnCanvas(field, { x: -1392, y: -487 }, SMALL_CANVAS)).toBe(0);
  });
});

describe('respawn engine wiring', () => {
  test('GameEngine respawn lands in the spawn disk', () => {
    const engine = new GameEngine(7);
    const ws = {} as never;
    const player = engine.addPlayer('pilot', 'Pilot', ws, { x: 3150, y: 0 });
    engine.entityManager.updateEntity('pilot', { spawnProtectionTimer: undefined });
    engine.handlePlayerDamage('pilot', 'boundary', player.health);
    for (let i = 0; i < SHIP.RESPAWN_DELAY_FRAMES; i++) {
      engine.entityManager.updateExplosions();
      engine.entityManager.updateRespawns();
    }
    const respawned = engine.getPlayer('pilot');
    expect(Math.hypot(respawned!.position.x, respawned!.position.y)).toBeLessThanOrEqual(
      getShipSpawnRadius() + 1
    );
    engine.stopGameLoop();
  });
});
