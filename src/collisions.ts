import { Ship } from './ship.js';
import { roidBelt, destroyRoid, Roid } from './asteroids.js';
import { fxHit } from './soundsMusic.js';
import { FPS, LASER_EXPLODE_DUR } from './config.js';

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
        ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
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
          ship.explode();
          destroyRoid(i, roids);
          fxHit.play();
        }
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
