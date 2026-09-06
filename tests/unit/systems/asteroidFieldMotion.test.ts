import { afterEach, describe, expect, test } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { GameEngine } from '../../../server/core/GameEngine';
import { RNGService } from '../../../server/core/RNGService';

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
});
