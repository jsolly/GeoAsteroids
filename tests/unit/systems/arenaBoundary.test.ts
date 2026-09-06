import { expect, test } from 'vitest';
import { ARENA } from '../../../src/constants';
import { getGameBoundary } from '../../../src/physics/boundary';
import { flooredDistance } from '../../../src/physics/Point';
import { checkCircularCollision } from '../../../src/physics/collision/collisionDetection';

test('arena radius is diameter/2 plus buffer', () => {
  expect(ARENA.BOUNDARY_DIAMETER / 2 + ARENA.BOUNDARY_BUFFER).toBe(ARENA.BOUNDARY_RADIUS);
  expect(getGameBoundary().radius).toBe(ARENA.BOUNDARY_RADIUS);
});

test('flooredDistance matches Point.distance rounding', () => {
  expect(flooredDistance(0, 0, 3, 4)).toBe(5);
  expect(flooredDistance(0, 0, 1000, 2000)).toBe(2236);
});

test('checkCircularCollision uses floored distance without changing contact rules', () => {
  expect(checkCircularCollision({ x: 0, y: 0 }, 5, { x: 3, y: 4 }, 0)).toBe(false);
  expect(checkCircularCollision({ x: 0, y: 0 }, 6, { x: 3, y: 4 }, 0)).toBe(true);
});
