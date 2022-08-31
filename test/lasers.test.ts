import { assert, expect, test } from 'vitest';
import { Point } from '../src/utils';
// Edit an assertion and save to see HMR in action

test('Point', () => {
  const newPoint = new Point(10, 20);
  expect(newPoint.x).toBe(10);
});
