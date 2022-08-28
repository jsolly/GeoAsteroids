import { Ship, explodeShip, resetShip } from './ship.js';
import { roidBelt, destroyRoid, Roid } from './asteroids.js';
import { music, fxHit } from './soundsMusic.js';
import { FPS, LASER_EXPLODE_DUR } from './constants.js';
import { newLevel, gameOver } from './scoreLevelLives.js';
import { update } from './main.js';

import { Laser } from './lasers.js';

function detectLaserHits(ship: Ship, roidBelt: roidBelt): void {
  const roids = roidBelt.roids;
  // detect laser hits
  for (let j = ship.lasers.length - 1; j >= 0; j--) {
    for (let i = roids.length - 1; i >= 0; i--) {
      // detect hits
      if (isHit(ship.lasers[j], roids[i])) {
        // remove asteroid and activate laser explosion
        destroyRoid(i, roids);
        fxHit.play();
        if (roids.length == 0) {
          newLevel(ship, roidBelt);
        }
        ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // calculate remianing ratio of remaining asteroids to determine
        // music tempo
        music.setRoidRatio(roids);
      }
    }
  }
}

function detectRoidHits(ship: Ship, roidBelt: roidBelt): void {
  const roids = roidBelt.roids;
  // check for asteroid collisions (when not exploding)
  if (!ship.exploding) {
    // only check when not blinking
    if (ship.blinkCount == 0 && !ship.dead) {
      for (let i = 0; i < roids.length; i++) {
        if (
          ship.centroid.distToPoint(roids[i].centroid) <
          ship.r + roids[i].r
        ) {
          explodeShip(ship);
          destroyRoid(i, roids);
          fxHit.play();

          if (roids.length == 0) {
            newLevel(ship, roidBelt);
          }
          music.setRoidRatio(roids);
          update();
        }
      }
    }
  } else {
    // reduce explode time
    ship.explodeTime--;
    if (ship.explodeTime == 0) {
      ship.lives--;
      if (ship.lives == 0) {
        gameOver(ship);
        update();
      } else {
        resetShip(ship.lives, ship.blinkOn);
        update();
      }
    }
  }
}

function isHit(laser: Laser, roid: Roid): boolean {
  if (
    laser.explodeTime == 0 &&
    roid.centroid.distToPoint(laser.centroid) < roid.r
  ) {
    return true;
  }
  return false;
}

export { detectLaserHits, detectRoidHits };
