import {SHIP_INV_BLINK_DUR, FPS, DEBUG} from './modules/constants.mjs';
import {distBetweenPoints} from './modules/utils.mjs';
import {
  drawAsteroidsRelative,
  destroyAsteroid,
  getRoidsInfo,
  moveAsteroids,
} from './modules/asteroids.mjs';
import {
  drawScores,
  drawLives,
  newLevel,
  resetScoreLevelLives,
} from './modules/scoreLevelLives.mjs';
import {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
} from './modules/canvas.mjs';
import {getMusicOn, fxHit, music} from './modules/soundsMusic.mjs';
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
  ship,
} from './modules/ship.mjs';
import {drawLasers, moveLasers} from './modules/lasers.mjs';
import {detectLaserHits} from './modules/collisions.mjs';

newGame();

/**
 * Resets score, ship, and level for a new game.
 */
function newGame() {
  resetScoreLevelLives();
  resetShip();
  newLevel();
}
/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver() {
  killShip();
  setTextProperties('Game Over', 1.0);
  music.tempo = 1.0;
  update();
}

// Set up game loop
setInterval(update, 1000 / FPS);

/**
 * Runs the game. Called every frame to move the game forward.
 */
function update() {
  if (DEBUG) {
    drawDebugFeatures();
  }

  const roids = getRoidsInfo().roids;
  setBlinkOn();
  setExploding();
  drawSpace();
  drawAsteroidsRelative(ship);
  drawScores();
  drawLives();

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
      drawShipRelative(ship.a);
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
    drawShipExplosion();
  }

  drawLasers();
  detectLaserHits();

  // check for asteroid collisions (when not exploding)
  if (!ship.exploding) {
    // only check when not blinking
    if (ship.blinkCount == 0 && !ship.dead) {
      for (let i = 0; i < roids.length; i++) {
        if (
          distBetweenPoints(ship.x, ship.y, roids[i].x, roids[i].y) <
          ship.r + roids[i].r
        ) {
          explodeShip();
          destroyAsteroid(i, roids);
          fxHit.play();

          if (roids.length == 0) {
            newLevel();
          }
          music.setAsteroidRatio();
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

  thrustShip();
  if (!ship.exploding) {
    moveShip();
  }
  // handleShipEdgeOfScreen();
  moveLasers();
  moveAsteroids();
}
export {gameOver, newGame, update};
