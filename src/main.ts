import {
  SHIP_INV_BLINK_DUR,
  FPS,
  DEBUG,
  LASER_EXPLODE_DUR,
} from './constants.js';
import { distBetweenPoints } from './utils.js';
import {
  drawAsteroidsRelative,
  destroyAsteroid,
  moveAsteroids,
  asteroidBelt,
  Roid,
} from './asteroids.js';
import {
  drawScores,
  drawLives,
  resetScoreLevelLives,
  newLevelText,
} from './scoreLevelLives.js';
import {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
} from './canvas.js';
import { getMusicOn, fxHit, music } from './soundsMusic.js';
import {
  resetShip,
  drawShipRelative,
  drawShipExplosion,
  explodeShip,
  killShip,
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
  Ship,
} from './ship.js';
import { drawLasers, moveLasers, Laser } from './lasers.js';
// import { detectLaserHits } from './collisions.js';

const ship = new Ship();
let roids = new asteroidBelt(ship).roids;

/**
 * Resets score, ship, and level for a new game.
 */
function newGame(): void {
  resetScoreLevelLives();
  newLevel();
}

/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function newLevel(): void {
  newLevelText();
}

/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver(): void {
  killShip(ship);
  setTextProperties('Game Over', 1.0);
  music.tempo = 1.0;
  update();
}

// Set up game loop
setInterval(update, 1000 / FPS);

/**
 * Runs the game. Called every frame to move the game forward.
 */
function update(): void {
  if (DEBUG) {
    drawDebugFeatures(ship);
  }

  setBlinkOn(ship);
  setExploding(ship);
  drawSpace();
  drawAsteroidsRelative(ship, roids);
  drawScores();
  drawLives(ship);

  if (getTextAlpha() >= 0) {
    drawGameText();
  } else if (ship.dead) {
    newGame();
  }

  // tick the music
  if (getMusicOn()) {
    music.tick();
  }

  // draw triangular ship
  if (!ship.exploding) {
    if (ship.blinkOn && !ship.dead) {
      drawShipRelative(ship);
    }

    // handle blinking
    if (ship.blinkCount > 0) {
      // reduce blink time
      ship.blinkTime--;

      // reduce blink count
      if (ship.blinkTime == 0) {
        ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        ship.blinkCount--;
      }
    }
  } else {
    drawShipExplosion(ship);
  }

  drawLasers(ship);

  // detect laser hits
  for (let i = roids.length - 1; i >= 0; i--) {
    for (let j = ship.lasers.length - 1; j >= 0; j--) {
      // detect hits
      if (isHit(ship.lasers[j], roids[i])) {
        // remove asteroid and activate laser explosion
        destroyAsteroid(i, roids);
        fxHit.play();
        if (roids.length == 0) {
          newLevel();
          roids = new asteroidBelt(ship).roids;
          update();
        }
        ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // calculate remianing ratio of remaining asteroids to determine
        // music tempo
        music.setAsteroidRatio(roids);
      }
    }
  }

  function isHit(laser: Laser, roid: Roid): boolean {
    if (
      laser.explodeTime == 0 &&
      distBetweenPoints(roid.centroid, laser.centroid) < roid.r
    ) {
      return true;
    }
  }

  // check for asteroid collisions (when not exploding)
  if (!ship.exploding) {
    // only check when not blinking
    if (ship.blinkCount == 0 && !ship.dead) {
      for (let i = 0; i < roids.length; i++) {
        if (
          distBetweenPoints(ship.centroid, roids[i].centroid) <
          ship.r + roids[i].r
        ) {
          explodeShip(ship);
          destroyAsteroid(i, roids);
          fxHit.play();

          if (roids.length == 0) {
            newLevel();
          }
          music.setAsteroidRatio(roids);
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
        gameOver();
      } else {
        resetShip(ship.lives, ship.blinkOn);
        update();
      }
    }
  }

  thrustShip(ship);
  if (!ship.exploding) {
    moveShip(ship);
  }
  moveLasers(ship);
  moveAsteroids(roids);
}
export { gameOver, newGame, update };
