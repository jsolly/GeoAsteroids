import {
  SHIP_SIZE,
  FPS,
  LASER_SPEED,
  LASER_MAX,
  LASER_DIST,
} from './constants.js';
import {ship} from './ship.js';
import {fxLaser} from './soundsMusic.js';
// import {handleLaserEdgeofScreen} from './collisions.js';
import {GAME_CANVAS, GAME_CONTEXT} from './canvas.js';
const ctx = GAME_CONTEXT;
const cvs = GAME_CANVAS;

/**
 * Add a laser to an array of lasers and play a laser shoot sound!
 */
function shootLaser() {
  // Create laser object
  if (ship.canShoot && ship.lasers.length < LASER_MAX) {
    ship.lasers.push({
      x: ship.x,
      y: ship.y,
      xv: (-LASER_SPEED * Math.cos(-ship.a)) / FPS + ship.xv,
      yv: (LASER_SPEED * Math.sin(-ship.a)) / FPS + ship.yv,
      distTraveled: 0,
      explodeTime: 0,
    });
    fxLaser.play();
  }
  // prevent further shooting
  ship.canShoot = false;
}

/**
 * Draw lasers from an array on the canvas
 */
function drawLasers() {
  for (let i = 0; i < ship.lasers.length; i++) {
    if (ship.lasers[i].explodeTime == 0) {
      ctx.fillStyle = 'salmon';
      ctx.beginPath();
      ctx.arc(
          ship.lasers[i].x - ship.x + cvs.width / 2,
          ship.lasers[i].y - ship.y + cvs.height / 2,
          SHIP_SIZE / 15,
          0,
          Math.PI * 2,
          false,
      );
      ctx.fill();
    } else {
      // draw explosion
      ctx.fillStyle = 'orangered';
      ctx.beginPath();
      ctx.arc(
          ship.lasers[i].x - ship.x + cvs.width / 2,
          ship.lasers[i].y - ship.y + cvs.height / 2,
          ship.r * 0.75,
          0,
          Math.PI * 2,
          false,
      );
      ctx.fill();
      ctx.fillStyle = 'salmon';
      ctx.beginPath();
      ctx.arc(
          ship.lasers[i].x - (ship.x - cvs.width),
          ship.lasers[i].y - (ship.y - cvs.height),
          ship.r * 0.5,
          0,
          Math.PI * 2,
          false,
      );
      ctx.fill();
      ctx.fillStyle = 'pink';
      ctx.beginPath();
      ctx.arc(
          ship.lasers[i].x - (ship.x - cvs.width),
          ship.lasers[i].y - (ship.y - cvs.height),
          ship.r * 0.25,
          0,
          Math.PI * 2,
          false,
      );
      ctx.fill();
    }
  }
}
/**
 * Move all lasers in an array by their x and y velocity
 */
function moveLasers() {
  for (let i = ship.lasers.length - 1; i >= 0; i--) {
    // check laser distance
    if (ship.lasers[i].distTraveled > LASER_DIST * cvs.width) {
      ship.lasers.splice(i, 1);
      continue;
    }

    // handle the explosion
    if (ship.lasers[i].explodeTime > 0) {
      ship.lasers[i].explodeTime--;

      if (ship.lasers[i].explodeTime == 0) {
        ship.lasers.splice(i, 1);
        continue;
      }
    } else {
      ship.lasers[i].x += ship.lasers[i].xv;
      ship.lasers[i].y += ship.lasers[i].yv;

      // calculate distance traveled
      ship.lasers[i].distTraveled += 0.5;
      // Math.sqrt(Math.pow(ship.lasers[i].xv, 2) + \
      // Math.pow(ship.lasers[i].yv, 2));
      // handleLaserEdgeofScreen(i);
    }
  }
}

export {drawLasers, shootLaser, moveLasers};
