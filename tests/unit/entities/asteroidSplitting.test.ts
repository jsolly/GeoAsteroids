import { expect, test, describe, beforeEach } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { RNGService } from '../../../server/core/RNGService';

describe('Asteroid Splitting System', () => {
  let asteroidManager: AsteroidManager;
  let rng: RNGService;

  beforeEach(() => {
    rng = new RNGService();
    asteroidManager = new AsteroidManager(rng);
  });

  test('large asteroid splits into two smaller asteroids', () => {
    // Create a large asteroid that should split (size 30)
    const largeAsteroid = {
      id: 'test-asteroid-large',
      position: { x: 400, y: 300 },
      velocity: { x: 1, y: 1 },
      size: 30, // Should be large enough to split (>= 25)
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 50,
      maxHealth: 50,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1]
    };

    asteroidManager.addAsteroid(largeAsteroid);
    expect(asteroidManager.getAsteroidCount()).toBe(1);

    // Destroy the asteroid
    const result = asteroidManager.destroyAsteroid('test-asteroid-large');

    // Should successfully destroy and create new asteroids
    expect(result.destroyed).toBeDefined();
    expect(result.destroyed?.size).toBe(30);
    expect(result.newAsteroids.length).toBe(2);
    expect(asteroidManager.getAsteroidCount()).toBe(2);

    // Check that new asteroids are smaller
    result.newAsteroids.forEach((asteroid) => {
      expect(asteroid.size).toBeLessThan(30);
      expect(asteroid.size).toBeGreaterThanOrEqual(10); // minAsteroidSize
    });
  });

  test('medium asteroid splits into two smaller asteroids', () => {
    // Create a medium asteroid that should split (size 25)
    const mediumAsteroid = {
      id: 'test-asteroid-medium',
      position: { x: 400, y: 300 },
      velocity: { x: 1, y: 1 },
      size: 25, // Should be large enough to split (>= 25)
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 40,
      maxHealth: 40,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1]
    };

    asteroidManager.addAsteroid(mediumAsteroid);
    expect(asteroidManager.getAsteroidCount()).toBe(1);

    // Destroy the asteroid
    const result = asteroidManager.destroyAsteroid('test-asteroid-medium');

    // Should successfully destroy and create new asteroids
    expect(result.destroyed).toBeDefined();
    expect(result.destroyed?.size).toBe(25);
    expect(result.newAsteroids.length).toBe(2);
    expect(asteroidManager.getAsteroidCount()).toBe(2);
  });

  test('small asteroid does not split', () => {
    // Create a small asteroid that should not split (size 20)
    const smallAsteroid = {
      id: 'test-asteroid-small',
      position: { x: 400, y: 300 },
      velocity: { x: 1, y: 1 },
      size: 4, // Should not split (< 5 in test mode, < 25 in normal mode)
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 30,
      maxHealth: 30,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1]
    };

    asteroidManager.addAsteroid(smallAsteroid);
    expect(asteroidManager.getAsteroidCount()).toBe(1);

    // Destroy the asteroid
    const result = asteroidManager.destroyAsteroid('test-asteroid-small');

    // Should destroy but not create new asteroids
    expect(result.destroyed).toBeDefined();
    expect(result.destroyed?.size).toBe(4);
    expect(result.newAsteroids.length).toBe(0);
    expect(asteroidManager.getAsteroidCount()).toBe(0);
  });

  test('asteroid splitting respects max count limit', () => {
    // Fill up the asteroid manager to near max capacity
    const maxCount = 200; // From DEBUG.ROIDS.MAX_COUNT
    const asteroidsToCreate = maxCount - 1; // Leave room for 1 more

    for (let i = 0; i < asteroidsToCreate; i++) {
      const asteroid = {
        id: `test-asteroid-${i}`,
        position: { x: 400, y: 300 },
        velocity: { x: 1, y: 1 },
        size: 15, // Small asteroids that won't split
        jaggedness: 0.5,
        rotation: 0,
        angularVelocity: 0,
        health: 20,
        maxHealth: 20,
        vertices: 8,
        offsets: [1, 1, 1, 1, 1, 1, 1, 1]
      };
      asteroidManager.addAsteroid(asteroid);
    }

    expect(asteroidManager.getAsteroidCount()).toBe(asteroidsToCreate);

    // Add one large asteroid that would normally split
    const largeAsteroid = {
      id: 'test-asteroid-large',
      position: { x: 400, y: 300 },
      velocity: { x: 1, y: 1 },
      size: 30,
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 50,
      maxHealth: 50,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1]
    };

    asteroidManager.addAsteroid(largeAsteroid);
    expect(asteroidManager.getAsteroidCount()).toBe(maxCount);

    // Try to destroy the large asteroid - should not split due to max count
    const result = asteroidManager.destroyAsteroid('test-asteroid-large');

    // Should destroy but not create new asteroids due to max count limit
    expect(result.destroyed).toBeDefined();
    expect(result.newAsteroids.length).toBe(0);
    expect(asteroidManager.getAsteroidCount()).toBe(asteroidsToCreate);
  });
});
