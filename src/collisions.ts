import { Ship } from './ship.js';
import { roidBelt, destroyRoid, Roid } from './asteroids.js';
import { music, fxHit } from './soundsMusic.js';
import { FPS, LASER_EXPLODE_DUR } from './constants.js';
import { newLevel } from './scoreLevelLives.js';

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

function isHit(laser: Laser, roid: Roid): boolean {
  if (
    laser.explodeTime == 0 &&
    roid.centroid.distToPoint(laser.centroid) < roid.r
  ) {
    return true;
  }
  return false;
}

export { detectLaserHits };
