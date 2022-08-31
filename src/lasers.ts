import {
  SHIP_SIZE,
  FPS,
  LASER_SPEED,
  LASER_MAX,
  LASER_DIST,
  CVS,
  CTX,
} from './constants.js';
import { Ship } from './ship.js';
import { fxLaser } from './soundsMusic.js';
import { Point } from './utils.js';

class Laser {
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
  if (canShootAndBelowLaserMax) {
    const xv: number = (-LASER_SPEED * Math.cos(-ship.a)) / FPS + ship.xv;
    const yv: number = (LASER_SPEED * Math.sin(-ship.a)) / FPS + ship.yv;
    const laserStartPoint = new Point(ship.centroid.x, ship.centroid.y);
    const laser = new Laser(laserStartPoint, xv, yv, 0, 0);
    ship.lasers.push(laser);
    fxLaser.play();
  }
  // prevent further shooting
  ship.canShoot = false;
}

/**
 * Draw lasers from an array on the canvas
 */
function drawLasers(ship: Ship): void {
  for (const laser of ship.lasers) {
    const ly = laser.centroid.y;
    const lx = laser.centroid.x;
    const shipX = ship.centroid.x;
    const shipY = ship.centroid.y;
    if (laser.explodeTime == 0) {
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        SHIP_SIZE / 15,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    } else {
      // draw explosion
      CTX.fillStyle = 'orangered';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        ship.r * 0.75,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.5,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'pink';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.25,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    }
  }
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

export { drawLasers, shootLaser, moveLasers, Laser };
