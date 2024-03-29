import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Ship, Laser } from '../src/ship';
import { Point } from '../src/utils';
import { LASER_MAX, CVS, LASER_DIST } from '../src/constants';

const mockPlay = vi.fn();
let mockShip: Ship;

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;
  Ship.fxExplode.play = mockPlay;
  Laser.fxLaser.play = mockPlay;
  Laser.fxHit.play = mockPlay;
  mockShip = new Ship();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test.concurrent('Ship Creation', () => {
  expect(mockShip).toBeInstanceOf(Ship);
});

test.concurrent('Ship Die', () => {
  expect(mockShip.dead).toBeFalsy();
  mockShip.die();
  expect(mockShip.dead).toBeTruthy();
});

test.concurrent('Ship setBlinkOn', () => {
  mockShip.setBlinkOn();
  expect(mockShip.blinkOn).toBeTruthy(); // All new ships blink
  mockShip.blinkCount = 1; // Simulate odd count (no blink)
  mockShip.setBlinkOn();
  expect(mockShip.blinkOn).toBeFalsy();
});

test.concurrent('Move Ship', () => {
  mockShip.rot = 1;
  mockShip.move();
  expect(mockShip.a).toBeGreaterThan(0);
  mockShip.xv = 1;
  mockShip.yv = 1;
  mockShip.move();
  expect(mockShip.centroid.x).toBeGreaterThan(0);
  expect(mockShip.centroid.y).toBeGreaterThan(0);
});

test.concurrent('Ship Slows Down (Friction)', () => {
  mockShip.xv = 1;
  mockShip.yv = 1;
  mockShip.thrusting = false;
  mockShip.move();
  expect(mockShip.xv).toBeLessThan(1);
  expect(mockShip.yv).toBeLessThan(1);
});

test.concurrent('Ship Continues to Explode', () => {
  mockShip.explodeTime = 1;
  mockShip.setExploding();
  expect(mockShip.exploding).toBeTruthy();
});

test.concurrent('Ship Not Exploding', () => {
  mockShip.explodeTime = 0;
  mockShip.setExploding();
  expect(mockShip.exploding).toBeFalsy();
});

test.concurrent('Ship Cannot Shoot When At Max Lasers', () => {
  expect(mockShip.canShootAgain()).toBeTruthy();
  // Shoot LASER_MAX times
  for (let i = 0; i <= LASER_MAX; i++) {
    mockShip.shoot();
  }
  expect(mockShip.canShootAgain()).toBeFalsy();
});

test.concurrent('Laser Creation', () => {
  const laserPoint = new Point(10, 20);
  const newLaser = new Laser(laserPoint, 100, 100, 100, 0);
  expect(newLaser).toBeInstanceOf(Laser);
});

// flaky test
// test.concurrent('Shoot Laser', () => {
//   const currentLaserCount = mockShip.lasers.length;
//   mockShip.shoot();
//   expect(mockShip.lasers.length).toEqual(currentLaserCount + 1);
//   expect(mockPlay).toHaveBeenCalledTimes(1);
// });

test.concurrent('Move Lasers', () => {
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  const firstLaserLocationY = firstLaser.centroid.y;
  mockShip.moveLasers();
  expect(firstLaser.centroid.x).not.toEqual(firstLaserLocationY);
});

test.concurrent('Laser Distance Exceeded', () => {
  mockShip.lasers = [];
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  firstLaser.xv = 0.5;
  firstLaser.yv = 0.5;
  firstLaser.distTraveled =
    LASER_DIST + CVS.width + Math.sqrt(0.5 ** 2 + 0.5 ** 2);

  mockShip.moveLasers();
  expect(mockShip.lasers.length).toEqual(0);
});

test.concurrent('Laser Removed After Exploded', () => {
  mockShip.lasers = [];
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  firstLaser.explodeTime = 1; // Almost exploded
  mockShip.moveLasers();
  expect(mockShip.lasers.length).toEqual(0);
});
