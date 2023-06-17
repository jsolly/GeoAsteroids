import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Difficulty, setDifficulty } from '../src/config';
import { Ship, Point } from '../src/objects';
import { Roid, RoidBelt } from '../src/asteroids';

let mockShip: Ship;

beforeEach(() => {
  mockShip = new Ship();
});

afterEach(() => {
  vi.restoreAllMocks();
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
