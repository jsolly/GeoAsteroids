import { expect, test } from 'vitest';
import { Point } from '../src/utils';

test.concurrent('Point Creation', () => {
  const firstPoint = new Point(10, 20);
  expect(firstPoint.x).toBe(10);
});

test.concurrent('Point distance calculation - non-zero distance', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(3, 4);
  expect(firstPoint.distToPoint(secondPoint)).toBe(5);
});

test.concurrent('Zero Point Distance', () => {
  const firstPoint = new Point(10, 20);
  const secondPoint = new Point(10, 20);
  expect(firstPoint.distToPoint(secondPoint)).toBe(0);
});
test.concurrent('Point Distance - Many', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(1000, 2000);
  expect(firstPoint.distToPoint(secondPoint)).toBe(2236);
});
