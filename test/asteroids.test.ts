import { expect, test } from 'vitest';
import { Difficulty, setDifficulty } from '../src/constants';
import { Asteroid, AsteroidBelt } from '../src/entities/asteroid/Asteroid.ts';
import { Vector } from '../src/physics/Vector.ts';

test('Asteroid Creation', () => {
  const roidPoint = new Vector(10, 20);
  const roidRadius = 10;
  const newRoid = new Asteroid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Asteroid);
});

test('Asteroid Belt Creation', () => {
  setDifficulty(Difficulty.easy); // This ensures roidNum is defined
  const testRoidBelt = new AsteroidBelt();
  expect(testRoidBelt).toBeInstanceOf(AsteroidBelt);
  expect(testRoidBelt.roids.length).toEqual(5);
});

test('Asteroid Belt Add Asteroid', () => {
  const testRoidBelt = new AsteroidBelt();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.addRoid();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1);
});

test('Asteroid Belt Spawn Asteroids', () => {
  const testRoidBelt = new AsteroidBelt();
  testRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.spawnRoids();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 4);
});

test('Destroy Asteroid', () => {
  const testRoidBelt = new AsteroidBelt();
  testRoidBelt.addRoid();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.destroyRoid(0);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1); // Asteroid splits in two
});

test('Move Asteroids', () => {
  const testRoidBelt = new AsteroidBelt();
  testRoidBelt.addRoid();
  const firstRoid = testRoidBelt.roids[0];
  const firstRoidLocationY = firstRoid.position.y;
  testRoidBelt.moveRoids();
  expect(firstRoid.position.x).not.equal(firstRoidLocationY);
});
