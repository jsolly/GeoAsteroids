import { SHIP_INV_BLINK_DUR, FPS, DEBUG } from './constants.js';
import { detectLaserHits, detectRoidHits } from './collisions.js';

import { drawRoidsRelative, moveRoids, spawnRoids } from './asteroids.js';
import {
  drawScores,
  drawLives,
  newGame,
  currentScore,
  newLevel,
} from './scoreLevelLives.js';
import {
  drawGameText,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
} from './canvas.js';
import { getMusicOn, music } from './soundsMusic.js';
import {
  drawShipRelative,
  drawShipExplosion,
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
} from './ship.js';
import { drawLasers, moveLasers } from './lasers.js';
import { keyUp, keyDown } from './keybindings.js';

let { ship, currRoidBelt, nextLevel } = newGame();

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

// Set up game loop
setInterval(update, 1000 / FPS);

/**
 * Runs the game. Called every frame to move the game forward.
 */
function update(): void {
  if (currentScore > nextLevel) {
    newLevel(ship, currRoidBelt);
    nextLevel += 1000;
  }
  const roids = currRoidBelt.roids;
  spawnRoids(currRoidBelt, ship);

  if (DEBUG) {
    drawDebugFeatures(ship);
  }

  setBlinkOn(ship);
  setExploding(ship);
  drawSpace();
  drawRoidsRelative(ship, roids);
  drawScores();
  drawLives(ship);

  if (getTextAlpha() >= 0) {
    drawGameText();
  } else if (ship.dead) {
    ({ ship, currRoidBelt, nextLevel } = newGame());
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
  detectLaserHits(ship, currRoidBelt);
  detectRoidHits(ship, currRoidBelt);

  thrustShip(ship);
  if (!ship.exploding) {
    moveShip(ship);
  }
  moveLasers(ship);
  moveRoids(roids);
}

export { ship };
