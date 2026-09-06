import { afterEach, describe, expect, test } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { GameEngine } from '../../../server/core/GameEngine';
import { RNGService } from '../../../server/core/RNGService';
import { getGameBoundary } from '../../../src/physics/boundary';
import { wrapAsteroidPosition } from '../../../src/physics/asteroidMotion';

describe('authoritative asteroid motion', () => {
  let engine: GameEngine | undefined;

  afterEach(() => {
    engine?.stopGameLoop();
    engine = undefined;
  });

  test('a server tick translates an asteroid by its velocity and rotates it', () => {
    const manager = new AsteroidManager(new RNGService(1));
    manager.createAsteroids(3);
    const asteroid = manager.getAllAsteroids()[0];
    expect(asteroid).toBeDefined();
    const id = asteroid!.id;

    manager.updateAsteroid(id, {
      position: { x: 10, y: 20 },
      velocity: { x: 3, y: -4 },
      rotation: 0.5,
      angularVelocity: 0.01,
    });

    manager.updateMotion();

    const moved = manager.getAsteroid(id);
    expect(moved?.position).toEqual({ x: 13, y: 16 });
    expect(moved?.rotation).toBeCloseTo(0.51);
  });

  test('asteroids move over time on the running server loop', async () => {
    engine = new GameEngine(1);
    engine.startGameLoop();
    engine.createAsteroids(5);

    const tracked = engine.getAllAsteroids()[0];
    expect(tracked).toBeDefined();
    engine.updateAsteroid(tracked!.id, {
      position: { x: 0, y: 0 },
      velocity: { x: 2, y: 0 },
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    const after = engine.getAsteroid(tracked!.id);
    expect(after).toBeDefined();
    expect(after!.position.x).toBeGreaterThan(2);
  });

  test('an escaped asteroid wraps back inside the playable arena', () => {
    const { radius } = getGameBoundary();
    const wrapped = wrapAsteroidPosition(10000, 8000);
    expect(Math.hypot(wrapped.x, wrapped.y)).toBeLessThanOrEqual(radius);
    expect(wrapped.x).toBeLessThan(0);
    expect(wrapped.y).toBeLessThan(0);
  });

  test('a server tick wraps an escaped asteroid instead of leaving the camera', () => {
    const manager = new AsteroidManager(new RNGService(1));
    manager.createAsteroids(1);
    const asteroid = manager.getAllAsteroids()[0];
    expect(asteroid).toBeDefined();
    manager.updateAsteroid(asteroid!.id, {
      position: { x: 12000, y: 0 },
      velocity: { x: 2, y: 0 },
    });
    manager.updateMotion();
    const after = manager.getAsteroid(asteroid!.id);
    const { radius } = getGameBoundary();
    expect(Math.hypot(after!.position.x, after!.position.y)).toBeLessThanOrEqual(radius);
  });
});
