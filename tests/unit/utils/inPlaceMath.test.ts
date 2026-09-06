import { expect, test } from 'vitest';
import {
  addPositionInPlace,
  capSpeedInPlace,
  scaleVelocityInPlace,
} from '../../../src/utils/mathUtils';

test('addPositionInPlace mutates the same object', () => {
  const pos = { x: 1, y: 2 };
  addPositionInPlace(pos, { x: 3, y: 4 });
  expect(pos).toEqual({ x: 4, y: 6 });
});

test('scaleVelocityInPlace mutates the same object', () => {
  const vel = { x: 10, y: -4 };
  scaleVelocityInPlace(vel, 0.5);
  expect(vel).toEqual({ x: 5, y: -2 });
});

test('capSpeedInPlace leaves sub-max speed unchanged', () => {
  const vel = { x: 3, y: 4 };
  capSpeedInPlace(vel, 10);
  expect(vel).toEqual({ x: 3, y: 4 });
});

test('capSpeedInPlace scales to max speed', () => {
  const vel = { x: 6, y: 8 };
  capSpeedInPlace(vel, 5);
  expect(vel.x).toBeCloseTo(3);
  expect(vel.y).toBeCloseTo(4);
});
