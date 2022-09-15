import { expect, test } from 'vitest';
import { Ship } from '../src/ship';
import { roidBelt } from '../src/asteroids';
import { Laser } from '../src/lasers';
import { detectLaserHits, detectRoidHits } from '../src/collisions';
test.concurrent('Detect Laser Hits', () => {
  const testShip = new Ship();
  const testRoidBelt = new roidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const laserLocation = testRoidBelt.roids[0].centroid; // Laser location is the centroid of the roid, so it automatically hits.
  const testLaser = new Laser(laserLocation, 0, 0, 0, 0);
  testShip.lasers.push(testLaser);
  detectLaserHits(testShip, testRoidBelt);
  expect(testRoidBelt.roids.length).toEqual(2);
});

test.concurrent('Detect Roid Hits', () => {
  const testShip = new Ship();
  expect(testShip.explodeTime).toEqual(0);
  testShip.blinkCount = 0;
  const testRoidBelt = new roidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const newShipLocation = testRoidBelt.roids[0].centroid;
  testShip.centroid = newShipLocation; // Ship location is the centroid of the roid, so it automatically hits.
  detectRoidHits(testShip, testRoidBelt);
  expect(testShip.explodeTime).toBeGreaterThan(0);
});
