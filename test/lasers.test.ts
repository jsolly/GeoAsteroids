import { expect, test } from 'vitest';
import { Point } from '../src/utils';
import { Laser, moveLasers, shootLaser } from '../src/lasers';
import { Ship } from '../src/ship';

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
});

test.concurrent('Move Lasers', () => {
  const testShip = new Ship(3, false);
  shootLaser(testShip);

  const firstLaser = testShip.lasers[0];
  const firstLaserLocationY = firstLaser.centroid.y;
  moveLasers(testShip);
  expect(firstLaser.centroid.x).not.equal(firstLaserLocationY);
});
