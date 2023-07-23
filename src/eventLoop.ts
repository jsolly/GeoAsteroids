import { FPS, DEBUG, SHIP_INV_BLINK_DUR, musicIsOn } from './config';
import { detectLaserHits, detectRoidHits } from './collisions';
import {
  drawGameText,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
  drawScores,
  drawLives,
} from './canvas.js';
import { drawShipRelative, drawShipExplosion, drawLasers } from './shipCanv';
import { drawRoidsRelative } from './asteroidsCanv';
import { showGameOverMenu } from './mainMenu';
import {
  nextLevel,
  currScore,
  currShip,
  currRoidBelt,
  setCurrentScore,
  updatePersonalBest,
  levelUp,
  gameOver,
  tickMusic,
} from './runtimeVars';

let isGameRunning: boolean;

function gameLoop(timestamp: number): void {
  if (!isGameRunning) return;

  const elapsedSeconds = updateTimestamp(timestamp);

  if (elapsedSeconds > 1 / FPS) {
    update();
  }

  window.requestAnimationFrame(gameLoop);
}

function updateTimestamp(timestamp: number): number {
  const elapsedSeconds = (timestamp - lastTimestamp) / 1000; // Convert ms to seconds
  lastTimestamp = timestamp;
  return elapsedSeconds;
}

function setIsGameRunning(value: boolean): void {
  isGameRunning = value;
}

let lastTimestamp: number;

function update(): void {
  if (currScore > nextLevel) {
    levelUp();
  }

  drawSpace();
  currRoidBelt.spawnRoids(currShip);
  if (DEBUG) {
    drawDebugFeatures(currShip);
  }
  drawRoidsRelative(currRoidBelt);
  drawLasers(currShip);
  drawScores();
  drawLives();
  if (getTextAlpha() >= 0) {
    drawGameText();
  } else if (currShip.dead) {
    showGameOverMenu();
  }

  currShip.setBlinkOn();
  currShip.setExploding();

  // tick the music
  if (musicIsOn()) {
    tickMusic();
  }

  // draw ship
  if (!currShip.exploding) {
    if (currShip.blinkOn && !currShip.dead) {
      drawShipRelative(currShip);
    }

    // handle blinking
    if (currShip.blinkCount > 0) {
      currShip.blinkTime--;

      // reduce blink count if blinking
      if (currShip.blinkTime == 0) {
        currShip.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        currShip.blinkCount--;
      }
    }
  } else {
    // handle ship explosion
    drawShipExplosion(currShip);
    // reduce explode time if exploding
    currShip.explodeTime--;
    if (currShip.explodeTime == 0) {
      currShip.lives--;
      if (currShip.lives == 0) {
        gameOver();
      }
    }
  }

  setCurrentScore(detectLaserHits(currRoidBelt, currShip));
  setCurrentScore(detectRoidHits(currShip, currRoidBelt));
  updatePersonalBest();

  if (!currShip.exploding) {
    currShip.move();
  }
  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

export { setIsGameRunning, gameLoop };
