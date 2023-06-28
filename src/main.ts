import {
  SHIP_INV_BLINK_DUR,
  FPS,
  DEBUG,
  musicIsOn,
  SAVE_KEY_PERSONAL_BEST,
} from './config.js';
import { detectLaserHits, detectRoidHits } from './collisions.js';
import {
  drawGameText,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
  drawScores,
  drawLives,
} from './canvas.js';
import { drawShipRelative, drawShipExplosion, drawLasers } from './shipCanv.js';
import { drawRoidsRelative } from './asteroidsCanv.js';
import { showGameOverMenu } from './events.js';
import { Ship } from './ship.js';
import { RoidBelt } from './asteroids.js';
import { STARTING_SCORE, START_LEVEL } from './config';
import { newLevelText, setTextProperties } from './canvas';
import { Music } from './soundsMusic';
import { keyDown, keyUp } from './keybindings';

const music = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');
let currShip = new Ship();
let currRoidBelt = new RoidBelt(currShip);
let currScore = STARTING_SCORE;
let currLevel = START_LEVEL;

document.addEventListener('keydown', (ev) => keyDown(ev, currShip));
document.addEventListener('keyup', (ev) => keyUp(ev, currShip));

function getCurrentShip(): Ship {
  return currShip;
}

function getCurrentRoidBelt(): RoidBelt {
  return currRoidBelt;
}

function getCurrentScore(): number {
  return currScore;
}

function getCurrentLevel(): number {
  return currLevel;
}

function updateCurrScore(valtoAdd: number): void {
  currScore += valtoAdd;
}

function resetMusicTempo(): void {
  music.setMusicTempo(1.0);
}

function tickMusic(): void {
  music.tick();
}

/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function levelUp(): void {
  currLevel += 1;
  newLevelText(currLevel);
  currRoidBelt.addRoid(currShip); // add a new asteroid for each new level
}

function newGame(): void {
  currScore = STARTING_SCORE;
  currLevel = START_LEVEL;
  newLevelText(currLevel);
  currShip = new Ship();
  currRoidBelt = new RoidBelt(currShip);
  music.setMusicTempo(1.0);
}

/**
 *
 * @returns - The current personal best score from local storage.
 */
function getPersonalBest(): number {
  const personalBest = localStorage.getItem(SAVE_KEY_PERSONAL_BEST);
  if (personalBest == null) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '0'); // set to 0 if null
    return 0;
  }
  return Number(localStorage.getItem(SAVE_KEY_PERSONAL_BEST));
}

function updatePersonalBest(): void {
  const personalBest = getPersonalBest();
  if (currScore > personalBest) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, String(currScore));
  }
}

function resetCurrScore(): void {
  currScore = STARTING_SCORE;
}
/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver(): void {
  const currShip = getCurrentShip();
  currShip.die();
  setTextProperties('Game Over', 1.0);
  resetMusicTempo();
}

/**
 * Runs the game. Called every frame to move the game forward.
 */
function update(): void {
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

  currScore += detectLaserHits(currRoidBelt, currShip);
  currScore += detectRoidHits(currShip, currRoidBelt);
  updatePersonalBest();

  if (!currShip.exploding) {
    currShip.move();
  }
  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

export {
  newGame,
  update,
  getCurrentShip,
  getCurrentRoidBelt,
  getCurrentScore,
  getCurrentLevel,
  getPersonalBest,
  updatePersonalBest,
  updateCurrScore,
  levelUp,
  resetCurrScore,
  resetMusicTempo,
  tickMusic,
};
