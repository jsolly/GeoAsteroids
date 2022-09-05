import { expect, test } from 'vitest';
import { Point } from '../src/utils';
import { Laser } from '../src/lasers';

test.concurrent('Laser Creation', () => {
  const laserPoint = new Point(10, 20);
  const newLaser = new Laser(laserPoint, 100, 100, 100, 0);
  expect(newLaser).toBeInstanceOf(Laser);
});
