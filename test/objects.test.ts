import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { LASER_MAX, Difficulty, setDifficulty } from '../src/config';
import { Ship, Laser, Point, Roid, RoidBelt } from '../src/objects';

const mockPlay = vi.fn();

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;
  Ship.fxExplode.play = mockPlay;
  Laser.fxLaser.play = mockPlay;
  Laser.fxHit.play = mockPlay;
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
  testShip.move();
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
  testShip.move();
  expect(testShip.xv).toBeLessThan(1);
  expect(testShip.yv).toBeLessThan(1);
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

test.concurrent('Laser Creation', () => {
  const laserPoint = new Point(10, 20);
  const newLaser = new Laser(laserPoint, 100, 100, 100, 0);
  expect(newLaser).toBeInstanceOf(Laser);
});

test.concurrent('Shoot Laser', () => {
  const testShip = new Ship();
  const currentLaserCount = testShip.lasers.length;
  testShip.shoot();
  expect(testShip.lasers.length).toEqual(currentLaserCount + 1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

test.concurrent('Move Lasers', () => {
  const testShip = new Ship();
  testShip.shoot();

  const firstLaser = testShip.lasers[0];
  const firstLaserLocationY = firstLaser.centroid.y;
  testShip.moveLasers();
  expect(firstLaser.centroid.x).not.toEqual(firstLaserLocationY);
});

test.concurrent('Laser Distance Exceeded', () => {
  const testShip = new Ship();
  testShip.shoot();

  const firstLaser = testShip.lasers[0];
  firstLaser.distTraveled = 100000;
  testShip.moveLasers();
  expect(testShip.lasers.length).toEqual(0);
});

test.concurrent('Laser Removed After Exploded', () => {
  const testShip = new Ship();
  testShip.shoot();

  const firstLaser = testShip.lasers[0];
  firstLaser.explodeTime = 1; // Almost exploded
  testShip.moveLasers();
  expect(testShip.lasers.length).toEqual(0);
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
  const testRoidBelt = new RoidBelt();
  expect(testRoidBelt).toBeInstanceOf(RoidBelt);
  expect(testRoidBelt.roids.length).toEqual(5);
});

test.concurrent('Roid Belt Add Roid', () => {
  const testRoidBelt = new RoidBelt();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.addRoid();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1);
});

test.concurrent('Roid Belt Spawn Roids', () => {
  const testRoidBelt = new RoidBelt();
  testRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.spawnRoids();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 4);
});

test.concurrent('Destory Roid', () => {
  const testRoidBelt = new RoidBelt();
  testRoidBelt.addRoid();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.destroyRoid(0);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1); // Roid splits in two
});

test.concurrent('Move Roids', () => {
  const testRoidBelt = new RoidBelt();
  testRoidBelt.addRoid();
  const firstRoid = testRoidBelt.roids[0];
  const firstRoidLocationY = firstRoid.centroid.y;
  testRoidBelt.moveRoids();
  expect(firstRoid.centroid.x).not.equal(firstRoidLocationY);
});
