import { expect, test } from 'vitest';

import { TOUCH } from '../../../src/constants';
import { readStickSample } from '../../../src/input/touchStick';

test('stick to the right aims along +x and thrusts when pushed far enough', () => {
  const sample = readStickSample(TOUCH.STICK_RADIUS, 0, 0, 0);
  expect(sample.heading).toBeCloseTo(0, 8);
  expect(sample.magnitude).toBeCloseTo(1, 8);
  expect(sample.aim).toBe(true);
  expect(sample.thrusting).toBe(true);
});

test('stick up aims +PI/2 using the same convention as mouse aim', () => {
  const sample = readStickSample(0, -TOUCH.STICK_RADIUS, 0, 0);
  expect(sample.heading).toBeCloseTo(Math.PI / 2, 8);
  expect(sample.thrusting).toBe(true);
});

test('deadzone ignores a rest tap so the ship can sit still', () => {
  const sample = readStickSample(2, 1, 0, 0);
  expect(sample.aim).toBe(false);
  expect(sample.thrusting).toBe(false);
});

test('mid throw aims without thrusting', () => {
  const radius = TOUCH.STICK_RADIUS * ((TOUCH.STICK_DEADZONE + TOUCH.STICK_THRUST) / 2);
  const sample = readStickSample(radius, 0, 0, 0);
  expect(sample.aim).toBe(true);
  expect(sample.thrusting).toBe(false);
});

test('pointer past the rim clamps the knob to the ring', () => {
  const sample = readStickSample(400, 0, 0, 0);
  expect(sample.magnitude).toBeCloseTo(1, 8);
  expect(sample.knobX).toBeCloseTo(TOUCH.STICK_RADIUS, 8);
  expect(sample.knobY).toBeCloseTo(0, 8);
});
