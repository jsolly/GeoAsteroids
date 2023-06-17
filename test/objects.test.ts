import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { LASER_MAX, Difficulty, setDifficulty } from '../src/config';
import { Ship, Laser, Point, Roid, RoidBelt } from '../src/objects';

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
  // Restore the original functions after each test
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

test.concurrent('Thrust Ship', () => {
  mockShip.thrusting = true;
  mockShip.move();
  expect(mockShip.xv).toBeLessThan(0);
  expect(mockShip.yv).toBeLessThan(0);
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

test.concurrent('Shoot Laser', () => {
  const currentLaserCount = mockShip.lasers.length;
  mockShip.shoot();
  expect(mockShip.lasers.length).toEqual(currentLaserCount + 1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

test.concurrent('Move Lasers', () => {
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  const firstLaserLocationY = firstLaser.centroid.y;
  mockShip.moveLasers();
  expect(firstLaser.centroid.x).not.toEqual(firstLaserLocationY);
});

test.concurrent('Laser Distance Exceeded', () => {
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  firstLaser.distTraveled = 100000;
  mockShip.moveLasers();
  expect(mockShip.lasers.length).toEqual(0);
});

test.concurrent('Laser Removed After Exploded', () => {
  mockShip.shoot();

  const firstLaser = mockShip.lasers[0];
  firstLaser.explodeTime = 1; // Almost exploded
  mockShip.moveLasers();
  expect(mockShip.lasers.length).toEqual(0);
});

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

test.concurrent('Roid Creation', () => {
  const roidPoint = new Point(10, 20);
  const roidRadius = 10;
  const newRoid = new Roid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Roid);
});

test.concurrent('Roid Belt Creation', () => {
  setDifficulty(Difficulty.easy); // This ensures roidNum is defined
  const testRoidBelt = new RoidBelt(mockShip);
  expect(testRoidBelt).toBeInstanceOf(RoidBelt);
  expect(testRoidBelt.roids.length).toEqual(5);
});

test.concurrent('Roid Belt Add Roid', () => {
  const testRoidBelt = new RoidBelt(mockShip);
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.addRoid(mockShip);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1);
});

test.concurrent('Roid Belt Spawn Roids', () => {
  const testRoidBelt = new RoidBelt(mockShip);
  testRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.spawnRoids(mockShip);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 4);
});

test.concurrent('Destory Roid', () => {
  const testRoidBelt = new RoidBelt(mockShip);
  testRoidBelt.addRoid(mockShip);
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.destroyRoid(0);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1); // Roid splits in two
});

test.concurrent('Move Roids', () => {
  const testRoidBelt = new RoidBelt(mockShip);
  testRoidBelt.addRoid(mockShip);
  const firstRoid = testRoidBelt.roids[0];
  const firstRoidLocationY = firstRoid.centroid.y;
  testRoidBelt.moveRoids();
  expect(firstRoid.centroid.x).not.equal(firstRoidLocationY);
});
