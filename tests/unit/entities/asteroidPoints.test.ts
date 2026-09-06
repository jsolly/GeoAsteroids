import { describe, expect, test } from 'vitest';
import { asteroidPointsForRadius } from '../../../src/physics/collision/collisionDetection';

describe('Asteroid Points Calculation', () => {
  test('returns 20 points for large asteroids (radius >= 40)', () => {
    expect(asteroidPointsForRadius(40)).toBe(20);
    expect(asteroidPointsForRadius(50)).toBe(20);
    expect(asteroidPointsForRadius(100)).toBe(20);
  });

  test('returns 50 points for medium asteroids (radius >= 20)', () => {
    expect(asteroidPointsForRadius(20)).toBe(50);
    expect(asteroidPointsForRadius(25)).toBe(50);
    expect(asteroidPointsForRadius(39)).toBe(50);
  });

  test('returns 100 points for small asteroids (radius < 20)', () => {
    expect(asteroidPointsForRadius(19)).toBe(100);
    expect(asteroidPointsForRadius(10)).toBe(100);
    expect(asteroidPointsForRadius(5)).toBe(100);
    expect(asteroidPointsForRadius(1)).toBe(100);
  });

  test('handles edge cases', () => {
    expect(asteroidPointsForRadius(0)).toBe(100);
    expect(asteroidPointsForRadius(19.9)).toBe(100);
    expect(asteroidPointsForRadius(20.0)).toBe(50);
    expect(asteroidPointsForRadius(39.9)).toBe(50);
    expect(asteroidPointsForRadius(40.0)).toBe(20);
  });
});
