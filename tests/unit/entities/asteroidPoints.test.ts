import { describe, expect, test } from 'vitest';
import { ROID } from '../../../src/constants';
import { pointsForAsteroidRadius } from '../../../src/entities/roid/roidPoints';
import { pointsForRoidSize } from '../../../src/entities/roid/roidScore';
import { asteroidPointsForRadius } from '../../../src/physics/collision/collisionDetection';

describe('Asteroid Points Calculation', () => {
  test('roidPoints aliases the collab-aware size buckets', () => {
    expect(pointsForAsteroidRadius(40)).toBe(pointsForRoidSize(40));
    expect(pointsForAsteroidRadius(40)).toBe(ROID.POINTS_LARGE);
    expect(pointsForAsteroidRadius(50)).toBe(ROID.POINTS_LARGE);
    expect(pointsForAsteroidRadius(100)).toBe(ROID.POINTS_LARGE);
  });

  test('returns medium-asteroid points for radius >= 20', () => {
    expect(pointsForAsteroidRadius(20)).toBe(ROID.POINTS_MEDIUM);
    expect(pointsForAsteroidRadius(25)).toBe(ROID.POINTS_MEDIUM);
    expect(pointsForAsteroidRadius(39)).toBe(ROID.POINTS_MEDIUM);
  });

  test('returns small-asteroid points for radius < 20', () => {
    expect(pointsForAsteroidRadius(19)).toBe(ROID.POINTS_SMALL);
    expect(pointsForAsteroidRadius(10)).toBe(ROID.POINTS_SMALL);
    expect(pointsForAsteroidRadius(5)).toBe(ROID.POINTS_SMALL);
    expect(pointsForAsteroidRadius(1)).toBe(ROID.POINTS_SMALL);
  });

  test('handles edge cases', () => {
    expect(pointsForAsteroidRadius(0)).toBe(ROID.POINTS_SMALL);
    expect(pointsForAsteroidRadius(19.9)).toBe(ROID.POINTS_SMALL);
    expect(pointsForAsteroidRadius(20.0)).toBe(ROID.POINTS_MEDIUM);
    expect(pointsForAsteroidRadius(39.9)).toBe(ROID.POINTS_MEDIUM);
    expect(pointsForAsteroidRadius(40.0)).toBe(ROID.POINTS_LARGE);
  });

  test('asteroidPointsForRadius matches the shared size table', () => {
    expect(asteroidPointsForRadius(50)).toBe(pointsForRoidSize(50));
    expect(asteroidPointsForRadius(20)).toBe(pointsForRoidSize(20));
    expect(asteroidPointsForRadius(10)).toBe(pointsForRoidSize(10));
  });
});
