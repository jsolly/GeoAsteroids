import { FPS, LASER_SPEED, LASER_MAX, LASER_DIST, CVS } from './config.js';
import { Ship } from './ship.js';
import { Sound } from './soundsMusic.js';
import { Point } from './utils.js';

class Laser {
  static fxLaser = new Sound('sounds/laser.m4a', 5);
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public centroid: Point,
    public xv: number,
    public yv: number,
    public distTraveled: number,
    public explodeTime: number,
  ) {}
}

/**
 * Add a laser to an array of lasers and play a laser shoot sound!
 */
function shootLaser(ship: Ship): void {
  function canShootAndBelowLaserMax(ship: Ship): boolean {
    if (ship.canShoot && ship.lasers.length < LASER_MAX) {
      return true;
    }
    return false;
  }

  // Create laser object
  if (canShootAndBelowLaserMax(ship)) {
    const xv: number = (-LASER_SPEED * Math.cos(-ship.a)) / FPS + ship.xv;
    const yv: number = (LASER_SPEED * Math.sin(-ship.a)) / FPS + ship.yv;

    const noseX =
      ship.centroid.x +
      ship.r * ((-1 / 3) * Math.cos(ship.a + 1.06) - Math.sin(ship.a + 1.06));
    const noseY =
      ship.centroid.y +
      ship.r * ((-1 / 3) * Math.sin(ship.a + 1.06) + Math.cos(ship.a + 1.06));

    const laserStartPoint = new Point(noseX, noseY);

    const laser = new Laser(laserStartPoint, xv, yv, 0, 0);
    ship.lasers.push(laser);
    Laser.fxLaser.play();
  }

  // prevent further shooting
  ship.canShoot = false;
}

/**
 * Move all lasers in an array by their x and y velocity
 */
function moveLasers(ship: Ship): void {
  for (let i = ship.lasers.length - 1; i >= 0; i--) {
    const laser = ship.lasers[i];

    // check laser distance
    if (laser.distTraveled > LASER_DIST * CVS.width) {
      ship.lasers.splice(i, 1);
      continue;
    }

    // handle the explosion
    if (laser.explodeTime > 0) {
      laser.explodeTime--;

      if (laser.explodeTime == 0) {
        ship.lasers.splice(i, 1);
        continue;
      }
    } else {
      laser.centroid = new Point(
        laser.centroid.x + laser.xv,
        laser.centroid.y + laser.yv,
      );

      // calculate distance traveled
      laser.distTraveled += 0.5;
    }
  }
}

export { shootLaser, moveLasers, Laser };
