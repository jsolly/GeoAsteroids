import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Point } from '../src/utils';
import { Laser, moveLasers, shootLaser } from '../src/lasers';
import { Ship } from '../src/ship';

const mockPlay = vi.fn();

beforeEach(() => {
  Laser.fxLaser.play = mockPlay;
  Laser.fxHit.play = mockPlay;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
});

test.concurrent('Laser Creation', () => {
  const laserPoint = new Point(10, 20);
  const newLaser = new Laser(laserPoint, 100, 100, 100, 0);
  expect(newLaser).toBeInstanceOf(Laser);
});

test.concurrent('Shoot Laser', () => {
  const testShip = new Ship(3, false);

  const currentLaserCount = testShip.lasers.length;
  shootLaser(testShip);
  expect(testShip.lasers.length).toEqual(currentLaserCount + 1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

test.concurrent('Move Lasers', () => {
  const testShip = new Ship(3, false);
  shootLaser(testShip);

  const firstLaser = testShip.lasers[0];
  const firstLaserLocationY = firstLaser.centroid.y;
  moveLasers(testShip);
  expect(firstLaser.centroid.x).not.toEqual(firstLaserLocationY);
});
