import { Laser, Ship } from './objects.js';
import { Roid, RoidBelt } from './asteroids.js';

function detectLaserHits(currRoidBelt: RoidBelt, currShip: Ship): number {
  const roids = currRoidBelt.roids;
  let score = 0;
  // detect laser hits
  for (let j = currShip.lasers.length - 1; j >= 0; j--) {
    for (let i = roids.length - 1; i >= 0; i--) {
      // detect hits
      if (isHit(currShip.lasers[j], roids[i])) {
        // remove asteroid and activate laser explosion
        Roid.fxHit.play();
        score = currRoidBelt.destroyRoid(i);
        currShip.updateLaserExplodeTime(j);
      }
    }
  }
  return score;
}

function detectRoidHits(currShip: Ship, currRoidBelt: RoidBelt): number {
  let score = 0;
  // check for asteroid collisions (when not exploding)
  if (!currShip.exploding) {
    // only check when not blinking
    if (currShip.blinkCount == 0 && !currShip.dead) {
      for (let i = 0; i < currRoidBelt.roids.length; i++) {
        if (
          currShip.centroid.distToPoint(currRoidBelt.roids[i].centroid) <
          currShip.r + currRoidBelt.roids[i].r
        ) {
          currShip.explode();
          Roid.fxHit.play();
          score = currRoidBelt.destroyRoid(i);
        }
      }
    }
  }
  return score;
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
