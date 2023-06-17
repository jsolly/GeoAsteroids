import { expect, test, beforeEach, afterEach, vi } from 'vitest';
import { detectLaserHits, detectRoidHits } from '../src/collisions';
import { Sound } from '../src/soundsMusic';
import { Laser, Ship, RoidBelt, Point } from '../src/objects';
let fxHitInstance: Sound;
let fxExplodeInstance: Sound;
const mockPlay = vi.fn();

beforeEach(() => {
  // Create instances of the Sound class
  fxHitInstance = new Sound('../public/sounds/hit.m4a', 5);
  fxExplodeInstance = new Sound('../public/sounds/explode.m4a', 5);

  // Replace the `play` method of `fxHit` and `fxExplode` with the mock function before running the test
  fxHitInstance.play = mockPlay;
  fxExplodeInstance.play = mockPlay;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
});

test.concurrent('Detect Laser Hits asteroid', () => {
  const testShip = new Ship();
  const testRoidBelt = new RoidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const laserLocation = testRoidBelt.roids[0].centroid; // Laser location is the centroid of the roid, so it automatically hits.
  const testLaser = new Laser(laserLocation, 0, 0, 0, 0);
  testShip.lasers.push(testLaser);
  detectLaserHits(testRoidBelt, testShip);
  expect(testRoidBelt.roids.length).toEqual(2);
});

test.concurrent('Detect Laser Does Not Hit asteroid', () => {
  const testShip = new Ship();
  const testRoidBelt = new RoidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const testRoidBeltLength = testRoidBelt.roids.length;
  // set laser location to be outside of any roid
  const laserLocation = new Point(1000, 1000);
  const testLaser = new Laser(laserLocation, 0, 0, 0, 0);
  testShip.lasers.push(testLaser);
  const tesShiptLaserLength = testShip.lasers.length;
  detectLaserHits(testRoidBelt, testShip);
  expect(testRoidBelt.roids.length).toEqual(testRoidBeltLength); // Expect no change in roid belt length
  expect(testShip.lasers.length).toEqual(tesShiptLaserLength); // Expect no change in ship laser length
  expect(testShip.lasers[0].explodeTime).toEqual(0); // Expect that laser is not exploding
});

test.concurrent('Detect ship hits asteroid', () => {
  const testShip = new Ship();
  testShip.blinkCount = 0; // Ship starts out blinking by default, so we set blinkCount to 0
  testShip.explodeTime = 0; // Make this explicit
  const testRoidBelt = new RoidBelt(testShip);
  testRoidBelt.addRoid(testShip);
  const testRoidBeltLength = testRoidBelt.roids.length;
  const newShipLocation = testRoidBelt.roids[0].centroid;
  testShip.centroid = newShipLocation; // Ship location is the centroid of the roid, so it automatically hits.
  detectRoidHits(testShip, testRoidBelt);
  expect(testRoidBelt.roids.length).toEqual(testRoidBeltLength + 1); // Expect i++ for roid belt as this is the first roid destroyed and it split into two
  expect(testShip.explodeTime).toBeGreaterThan(0); // Expect that ship is exploding
});

test.concurrent(
  'Detect Ship Passes Through Asteroid With Blinking Ship',
  () => {
    const testShip = new Ship();
    const testRoidBelt = new RoidBelt(testShip);
    testShip.explodeTime = 0; // Make this explicit
    testRoidBelt.addRoid(testShip);
    const newShipLocation = testRoidBelt.roids[0].centroid;
    testShip.centroid = newShipLocation; // Ship location is the centroid of the roid
    detectRoidHits(testShip, testRoidBelt);
    expect(testShip.explodeTime).toEqual(0); // Expect that ship is not exploding
  },
);

test.concurrent('Roids Do Not Hit Exploding Ship', () => {
  const testShip = new Ship();
  const testRoidBelt = new RoidBelt(testShip);
  testShip.exploding = true;
  testShip.explodeTime = 10;

  testRoidBelt.addRoid(testShip);
  const newShipLocation = testRoidBelt.roids[0].centroid;
  testShip.centroid = newShipLocation; // Ship location is the centroid of the roid, so it automatically hits.
  detectRoidHits(testShip, testRoidBelt);
});
