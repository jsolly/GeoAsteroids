import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { moveShip, Ship, thrustShip } from '../src/ship';

const mockPlay = vi.fn();

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxExplode.play = mockPlay;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
});

test.concurrent('Ship Creation', () => {
  const testShip = new Ship();
  expect(testShip).toBeInstanceOf(Ship);
});

test.concurrent('Ship Die', () => {
  const testShip = new Ship();
  expect(testShip.dead).toBeFalsy();
  testShip.die();
  expect(testShip.dead).toBeTruthy();
});

test.concurrent('Ship setBlinkOn', () => {
  const testShip = new Ship();
  testShip.setBlinkOn();
  expect(testShip.blinkOn).toBeTruthy(); // All new ships blink
  testShip.blinkCount = 1; // Simulate odd count (no blink)
  testShip.setBlinkOn();
  expect(testShip.blinkOn).toBeFalsy();
});

test.concurrent('Thrust Ship', () => {
  const testShip = new Ship();
  testShip.thrusting = true;
  thrustShip(testShip);
  expect(testShip.xv).toBeLessThan(0);
  expect(testShip.yv).toBeLessThan(0);
});

test.concurrent('Move Ship', () => {
  const testShip = new Ship();
  testShip.rot = 1;
  moveShip(testShip);
  expect(testShip.a).toBeGreaterThan(0);
  testShip.xv = 1;
  testShip.yv = 1;
  moveShip(testShip);
  expect(testShip.centroid.x).toBeGreaterThan(0);
  expect(testShip.centroid.y).toBeGreaterThan(0);
});
