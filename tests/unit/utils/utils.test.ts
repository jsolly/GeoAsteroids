import { expect, test } from 'vitest';
import { Point } from '../../../src/physics/Point';

test('Point Creation', () => {
  const firstPoint = new Point(10, 20);
  expect(firstPoint.x).toBe(10);
});

test('Point distance calculation - non-zero distance', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(3, 4);
  expect(firstPoint.distance(secondPoint)).toBe(5);
});

test('Zero Point Distance', () => {
  const firstPoint = new Point(10, 20);
  const secondPoint = new Point(10, 20);
  expect(firstPoint.distance(secondPoint)).toBe(0);
});
test('Point Distance - Many', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(1000, 2000);
  expect(firstPoint.distance(secondPoint)).toBe(2236);
});
