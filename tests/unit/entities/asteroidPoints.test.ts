import { describe, expect, test } from 'vitest';
import { ROID } from '../../../src/constants';
import { getAsteroidPoints } from '../../../src/entities/roid/roidPoints';

describe('Asteroid Points Calculation', () => {
  test('returns large-asteroid points for radius >= LARGE_RADIUS', () => {
    expect(getAsteroidPoints(ROID.LARGE_RADIUS)).toBe(ROID.POINTS_LARGE);
    expect(getAsteroidPoints(50)).toBe(ROID.POINTS_LARGE);
    expect(getAsteroidPoints(100)).toBe(ROID.POINTS_LARGE);
  });

  test('returns medium-asteroid points for radius >= MEDIUM_RADIUS', () => {
    expect(getAsteroidPoints(ROID.MEDIUM_RADIUS)).toBe(ROID.POINTS_MEDIUM);
    expect(getAsteroidPoints(25)).toBe(ROID.POINTS_MEDIUM);
    expect(getAsteroidPoints(39)).toBe(ROID.POINTS_MEDIUM);
  });

  test('returns small-asteroid points for radius < MEDIUM_RADIUS', () => {
    expect(getAsteroidPoints(19)).toBe(ROID.POINTS_SMALL);
    expect(getAsteroidPoints(10)).toBe(ROID.POINTS_SMALL);
    expect(getAsteroidPoints(5)).toBe(ROID.POINTS_SMALL);
    expect(getAsteroidPoints(1)).toBe(ROID.POINTS_SMALL);
  });

  test('handles edge cases', () => {
    expect(getAsteroidPoints(0)).toBe(ROID.POINTS_SMALL);
    expect(getAsteroidPoints(19.9)).toBe(ROID.POINTS_SMALL);
    expect(getAsteroidPoints(20.0)).toBe(ROID.POINTS_MEDIUM);
    expect(getAsteroidPoints(39.9)).toBe(ROID.POINTS_MEDIUM);
    expect(getAsteroidPoints(40.0)).toBe(ROID.POINTS_LARGE);
  });
});
