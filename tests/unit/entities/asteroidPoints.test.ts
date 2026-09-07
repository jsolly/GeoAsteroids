import { describe, expect, test } from 'vitest';
import { pointsForRoidSize } from '../../../src/entities/roid/roidScore';
import { asteroidPointsForRadius } from '../../../src/physics/collision/collisionDetection';

describe('Asteroid Points Calculation', () => {
  test('returns 20 points for large asteroids (radius >= 40)', () => {
    expect(pointsForRoidSize(40)).toBe(20);
    expect(pointsForRoidSize(50)).toBe(20);
    expect(pointsForRoidSize(100)).toBe(20);
  });

  test('returns 50 points for medium asteroids (radius >= 20)', () => {
    expect(pointsForRoidSize(20)).toBe(50);
    expect(pointsForRoidSize(25)).toBe(50);
    expect(pointsForRoidSize(39)).toBe(50);
  });

  test('returns 100 points for small asteroids (radius < 20)', () => {
    expect(pointsForRoidSize(19)).toBe(100);
    expect(pointsForRoidSize(10)).toBe(100);
    expect(pointsForRoidSize(5)).toBe(100);
    expect(pointsForRoidSize(1)).toBe(100);
  });

  test('handles edge cases', () => {
    expect(pointsForRoidSize(0)).toBe(100);
    expect(pointsForRoidSize(19.9)).toBe(100);
    expect(pointsForRoidSize(20.0)).toBe(50);
    expect(pointsForRoidSize(39.9)).toBe(50);
    expect(pointsForRoidSize(40.0)).toBe(20);
  });

  test('asteroidPointsForRadius matches the shared size table', () => {
    expect(asteroidPointsForRadius(50)).toBe(pointsForRoidSize(50));
    expect(asteroidPointsForRadius(20)).toBe(pointsForRoidSize(20));
    expect(asteroidPointsForRadius(10)).toBe(pointsForRoidSize(10));
  });
});
