import { expect, test } from 'vitest';
import { ROID_NUM } from '../src/constants';
import { Asteroid, createAsteroidBelt } from '../src/entities/asteroid/Asteroid.ts';
import { Vector } from '../src/physics/Vector.ts';

test('Asteroid Creation', () => {
  const roidPoint = new Vector(10, 20);
  const roidRadius = 10;
  const newRoid = new Asteroid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Asteroid);
});

test('Asteroid Belt Creation', () => {
  const testRoidBelt = createAsteroidBelt();
  expect(testRoidBelt).toBeInstanceOf(testRoidBelt.constructor);
  expect(testRoidBelt.roids.length).toEqual(ROID_NUM);
});

test('Asteroid Belt Add Asteroid', () => {
  const testRoidBelt = createAsteroidBelt();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.addRoid();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1);
});

test('Asteroid Belt Spawn Asteroids', () => {
  const testRoidBelt = createAsteroidBelt();
  testRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.spawnRoids();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 4);
});

test('Destroy Asteroid', () => {
  const testRoidBelt = createAsteroidBelt();
  testRoidBelt.addRoid();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.destroyRoid(0);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1); // Asteroid splits in two
});

test('Move Asteroids', () => {
  const testRoidBelt = createAsteroidBelt();
  testRoidBelt.addRoid();
  const firstRoid = testRoidBelt.roids[0];

  // Set deterministic velocity to ensure movement test is reliable
  firstRoid.velocity = new Vector(1, 0); // Move right at 1 unit per frame

  const previousX = firstRoid.position.x;
  testRoidBelt.moveRoids();
  expect(firstRoid.position.x).not.toEqual(previousX);
});

// Debug functionality is tested separately in the debug system
// since it's completely decoupled from the main asteroid logic
