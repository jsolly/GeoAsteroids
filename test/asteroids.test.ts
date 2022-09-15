import { expect, test } from 'vitest';
import { Point } from '../src/utils';
import {
  Roid,
  roidBelt,
  spawnRoids,
  destroyRoid,
  moveRoids,
} from '../src/asteroids';
import { Ship } from '../src/ship';
import { newLevel } from '../src/main';

test.concurrent('Roid Creation', () => {
  const roidPoint = new Point(10, 20);
  const roidRadius = 10;
  const newRoid = new Roid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Roid);
});

test.concurrent('Roid Belt Creation', () => {
  const testShip = new Ship(3, false);
  const newRoidBelt = new roidBelt(testShip);
  expect(newRoidBelt).toBeInstanceOf(roidBelt);
});

test.concurrent('Roid Belt Add Roid', () => {
  const testShip = new Ship(3, false);
  const newRoidBelt = new roidBelt(testShip);
  const roidCount = newRoidBelt.roids.length;
  newRoidBelt.addRoid(testShip);
  expect(newRoidBelt.roids.length).toEqual(roidCount + 1);
});

test.concurrent('Roid Belt Spawn Roids', () => {
  const testShip = new Ship(3, false);
  const newRoidBelt = new roidBelt(testShip);
  newRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  newLevel(testShip, newRoidBelt);
  const roidCount = newRoidBelt.roids.length;
  spawnRoids(newRoidBelt, testShip);
  expect(newRoidBelt.roids.length).toEqual(roidCount + 4);
});

test.concurrent('Destory Roid', () => {
  const testShip = new Ship(3, false);
  const newRoidBelt = new roidBelt(testShip);
  newRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  newLevel(testShip, newRoidBelt);
  const roidCount = newRoidBelt.roids.length;
  destroyRoid(0, newRoidBelt.roids); //Destroy first one
  expect(newRoidBelt.roids.length).toEqual(roidCount + 1); // Roid splits in two
});

test.concurrent('Move Roids', () => {
  const testShip = new Ship(3, false);
  const newRoidBelt = new roidBelt(testShip);
  newRoidBelt.spawnTime = 0; // so we don't have to wait a second for the spawn time to hit
  newLevel(testShip, newRoidBelt);

  const firstRoid = newRoidBelt.roids[0];
  const firstRoidLocationY = firstRoid.centroid.y;
  moveRoids(newRoidBelt.roids);
  expect(firstRoid.centroid.x).not.equal(firstRoidLocationY);
});
