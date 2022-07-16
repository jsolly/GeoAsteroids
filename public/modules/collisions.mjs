import { LASER_EXPLODE_DUR, FPS } from "./constants.mjs";
import {
  destroyAsteroid,
  createAsteroidBelt,
  getRoidsInfo,
} from "./asteroids.mjs";
import { ship } from "./ship.mjs";
import { newLevel } from "./scoreLevelLives.mjs";
import { distBetweenPoints } from "./utils.mjs";
import { fxHit, music } from "./soundsMusic.mjs";
import { update } from "../main.js";
import { GAME_CANVAS } from "./canvas.mjs";
// detect laser hits on asteroids
let ax;
let ay;
let ar;
let lx;
let ly;

/**
 * Detects whether a laser has hit an asteroid. Plays a sound if true and
 * calls destroyAsteroid(). If there are no astroids left, call newLevel().
 */
function detectLaserHits() {
  const roids = getRoidsInfo().roids;
  for (let i = roids.length - 1; i >= 0; i--) {
    // grab asteroid properties
    ax = roids[i].x;
    ay = roids[i].y;
    ar = roids[i].r;

    for (let j = ship.lasers.length - 1; j >= 0; j--) {
      // grab laser properties
      lx = ship.lasers[j].x;
      ly = ship.lasers[j].y;

      // detect hits
      if (
        ship.lasers[j].explodeTime == 0 &&
        distBetweenPoints(ax, ay, lx, ly) < ar
      ) {
        // remove asteroid and activate laser explosion
        destroyAsteroid(i, roids);
        fxHit.play();

        if (roids.length == 0) {
          newLevel();
          createAsteroidBelt();
          update();
        }
        ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // calculate remianing ratio of remaining asteroids to determine
        // music tempo
        music.setAsteroidRatio();
      }
    }
  }
}

/**
 * Move pop ship onto other side if it goes offscreen
 * @todo remove this func because the ship loation stays in the middle now?
 */
function handleShipEdgeOfScreen() {
  const cvs = GAME_CANVAS;
  if (ship.x < 0 - ship.r) {
    ship.x = cvs.width + ship.r;
  } else if (ship.x > cvs.width + ship.r) {
    ship.x = 0 + ship.r;
  }

  if (ship.y < 0 - ship.r) {
    ship.y = cvs.height + ship.r;
  } else if (ship.y > cvs.height + ship.r) {
    ship.y = 0 + ship.r;
  }
}
/**
 * moves a laser back into the canvas if it goes offscreen
 * @param {number} i - Index of laser to handle offscreen
 * @todo remove this func? I think we want to let lasers exit the canvas.
 */
function handleLaserEdgeofScreen(i) {
  const cvs = GAME_CANVAS;
  // handle edge of screen
  if (ship.lasers[i].x < 0) {
    ship.lasers[i].x = cvs.width;
  } else if (ship.lasers[i].x > cvs.width) {
    ship.lasers[i].x = 0;
  }

  if (ship.lasers[i].y < 0) {
    ship.lasers[i].y = cvs.height;
  } else if (ship.lasers[i].y > cvs.height) {
    ship.lasers[i].y = 0;
  }
}

export { detectLaserHits, handleShipEdgeOfScreen, handleLaserEdgeofScreen };
