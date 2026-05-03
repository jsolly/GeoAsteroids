import { expect, test, describe } from 'vitest';

// Import the private method by accessing it through the class
import { CollisionManager } from '../../../src/physics/collision/CollisionManager';

describe('Asteroid Points Calculation', () => {
  // Create a test instance to access the private method
  const collisionManager = CollisionManager.getInstance();
  
  // Access the private method through bracket notation
  const getAsteroidPoints = (collisionManager as any).getAsteroidPoints.bind(collisionManager);

  test('returns 20 points for large asteroids (radius >= 40)', () => {
    expect(getAsteroidPoints(40)).toBe(20);
    expect(getAsteroidPoints(50)).toBe(20);
    expect(getAsteroidPoints(100)).toBe(20);
  });

  test('returns 50 points for medium asteroids (radius >= 20)', () => {
    expect(getAsteroidPoints(20)).toBe(50);
    expect(getAsteroidPoints(25)).toBe(50);
    expect(getAsteroidPoints(39)).toBe(50);
  });

  test('returns 100 points for small asteroids (radius < 20)', () => {
    expect(getAsteroidPoints(19)).toBe(100);
    expect(getAsteroidPoints(10)).toBe(100);
    expect(getAsteroidPoints(5)).toBe(100);
    expect(getAsteroidPoints(1)).toBe(100);
  });

  test('handles edge cases', () => {
    expect(getAsteroidPoints(0)).toBe(100);
    expect(getAsteroidPoints(19.9)).toBe(100);
    expect(getAsteroidPoints(20.0)).toBe(50);
    expect(getAsteroidPoints(39.9)).toBe(50);
    expect(getAsteroidPoints(40.0)).toBe(20);
  });
});
