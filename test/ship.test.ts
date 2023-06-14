import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Ship } from '../src/ship';
import { generateLaser } from '../src/lasers';
import { LASER_MAX } from '../src/config';

const mockPlay = vi.fn();

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;
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
  testShip.thrust();
  expect(testShip.xv).toBeLessThan(0);
  expect(testShip.yv).toBeLessThan(0);
});

test.concurrent('Move Ship', () => {
  const testShip = new Ship();
  testShip.rot = 1;
  testShip.move();
  expect(testShip.a).toBeGreaterThan(0);
  testShip.xv = 1;
  testShip.yv = 1;
  testShip.move();
  expect(testShip.centroid.x).toBeGreaterThan(0);
  expect(testShip.centroid.y).toBeGreaterThan(0);
});

test.concurrent('Ship Slows Down (Friction)', () => {
  const testShip = new Ship();
  testShip.xv = 1;
  testShip.yv = 1;
  testShip.thrusting = false;
  testShip.thrust();
  expect(testShip.xv).toBeLessThan(1);
  expect(testShip.yv).toBeLessThan(1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

test.concurrent('Ship Continues to Explode', () => {
  const testShip = new Ship();
  testShip.explodeTime = 1;
  testShip.setExploding();
  expect(testShip.exploding).toBeTruthy();
});

test.concurrent('Ship Not Exploding', () => {
  const testShip = new Ship();
  testShip.explodeTime = 0;
  testShip.setExploding();
  expect(testShip.exploding).toBeFalsy();
});

test.concurrent('Ship Cannot Shoot When At Max Lasers', () => {
  const testShip = new Ship();
  expect(testShip.canShootAgain()).toBeTruthy();
  // Shoot LASER_MAX times
  for (let i = 0; i <= LASER_MAX; i++) {
    testShip.shoot();
  }
  expect(testShip.canShootAgain()).toBeFalsy();
});
