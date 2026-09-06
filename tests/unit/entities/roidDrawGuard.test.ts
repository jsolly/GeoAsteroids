import { expect, test } from 'vitest';
import { canDrawAsteroid } from '../../../src/entities/roid/roidRenderer';

test('a finite pose with offsets is drawable', () => {
  expect(
    canDrawAsteroid({
      position: { x: 10, y: -4 },
      r: 20,
      angle: 0.2,
      offsets: [1, 0.9, 1.1],
    })
  ).toBe(true);
});

test('NaN poses are skipped so one bad roid cannot crash the frame', () => {
  expect(
    canDrawAsteroid({
      position: { x: Number.NaN, y: 0 },
      r: 20,
      angle: 0,
      offsets: [1],
    })
  ).toBe(false);
});

test('empty offsets still draw — same pose the minimap already dots', () => {
  expect(
    canDrawAsteroid({
      position: { x: 0, y: 0 },
      r: 20,
      angle: 0,
      offsets: [],
    })
  ).toBe(true);
});
