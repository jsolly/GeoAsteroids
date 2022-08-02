import {
  SHIP_SIZE,
  FPS,
  LASER_SPEED,
  LASER_MAX,
  LASER_DIST,
  CVS,
  CTX,
} from './constants.js';
import { ship } from './ship.js';
import { fxLaser } from './soundsMusic.js';

let laser: {
  x: number;
  y: number;
  xv: number;
  yv: number;
  distTraveled: number;
  explodeTime: number;
};

/**
 * Add a laser to an array of lasers and play a laser shoot sound!
 */
function shootLaser(): void {
  // Create laser object
  if (ship.canShoot && ship.lasers.length < LASER_MAX) {
    laser = {
      x: ship.x,
      y: ship.y,
      xv: (-LASER_SPEED * Math.cos(-ship.a)) / FPS + ship.xv,
      yv: (LASER_SPEED * Math.sin(-ship.a)) / FPS + ship.yv,
      distTraveled: 0,
      explodeTime: 0,
    };
    ship.lasers.push(laser);
    fxLaser.play();
  }
  // prevent further shooting
  ship.canShoot = false;
}

/**
 * Draw lasers from an array on the canvas
 */
function drawLasers(): void {
  for (laser of ship.lasers) {
    if (laser.explodeTime == 0) {
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        laser.x - ship.x + CVS.width / 2,
        laser.y - ship.y + CVS.height / 2,
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
        laser.x - ship.x + CVS.width / 2,
        laser.y - ship.y + CVS.height / 2,
        ship.r * 0.75,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        laser.x - (ship.x - CVS.width),
        laser.y - (ship.y - CVS.height),
        ship.r * 0.5,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'pink';
      CTX.beginPath();
      CTX.arc(
        laser.x - (ship.x - CVS.width),
        laser.y - (ship.y - CVS.height),
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
function moveLasers(): void {
  for (let i = ship.lasers.length - 1; i >= 0; i--) {
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
      laser.x += laser.xv;
      laser.y += laser.yv;

      // calculate distance traveled
      laser.distTraveled += 0.5;
    }
  }
}

export { drawLasers, shootLaser, moveLasers, laser };
