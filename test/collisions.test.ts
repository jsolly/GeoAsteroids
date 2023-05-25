import { expect, test } from 'vitest';
import { Ship } from '../src/ship';
import { roidBelt } from '../src/asteroids';
import { Laser } from '../src/lasers';
import { detectLaserHits, detectRoidHits } from '../src/collisions';
import { Point } from '../src/utils';
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

test.concurrent('Detect ship hits asteroid', () => {
  const testShip = new Ship();
  testShip.blinkCount = 0; // Ship starts out blinking by default, so we set blinkCount to 0
  testShip.explodeTime = 0; // Make this explicit
  const testShipInitialLiveCount = testShip.lives;
  const testRoidBelt = new roidBelt(testShip);
  const testRoidBeltLength = testRoidBelt.roids.length;
  testRoidBelt.addRoid(testShip);
  const newShipLocation = testRoidBelt.roids[0].centroid;
  testShip.centroid = newShipLocation; // Ship location is the centroid of the roid, so it automatically hits.
  detectRoidHits(testShip, testRoidBelt);
  expect(testShip.explodeTime).toBeGreaterThan(0); // Expect that ship is exploding
  expect(testRoidBelt.roids.length).toEqual(testRoidBeltLength + 1); // Expect i++ for roid belt as this is the first roid destroyed and it split into two
  expect(testShip.lives).toEqual(testShipInitialLiveCount - 1); // Expect that ship has lost a life
});

test.concurrent(
  'Detect Ship Passes Through Asteroid With Blinking Ship',
  () => {
    const testShip = new Ship();
    testShip.explodeTime = 0; // Make this explicit
    const testRoidBelt = new roidBelt(testShip);
    testRoidBelt.addRoid(testShip);
    const newShipLocation = testRoidBelt.roids[0].centroid;
    testShip.centroid = newShipLocation; // Ship location is the centroid of the roid
    detectRoidHits(testShip, testRoidBelt);
    expect(testShip.explodeTime).toEqual(0); // Expect that ship is not exploding
  },
);

test.concurrent('Roids Do Not Hit Exploding Ship', () => {
  const testShip = new Ship();
  testShip.exploding = true;
  testShip.explodeTime = 10;
  const testRoidBelt = new roidBelt(testShip);
  const newShipLocation = testRoidBelt.roids[0].centroid;
  testShip.centroid = newShipLocation; // Ship location is the centroid of the roid, so it automatically hits.
  detectRoidHits(testShip, testRoidBelt);
});

test.concurrent('Detect Roid Hits With No Collision', () => {
  const testShip = new Ship();
  testShip.blinkCount = 0;
  const testRoidBelt = new roidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const newShipLocation = new Point(100, 100); // Assume Point is a class for 2D coordinates
  testShip.centroid = newShipLocation; // Ship location is far from the roid, so no collision.
  detectRoidHits(testShip, testRoidBelt);
  expect(testShip.explodeTime).toEqual(0); // Expect that ship is not exploding because no collision occurred
});
