import {
  SHIP_INV_BLINK_DUR,
  FPS,
  DEBUG,
  NEXT_LEVEL_POINTS,
} from './constants.js';
import { detectLaserHits, detectRoidHits } from './collisions.js';
import { keyUp, keyDown } from './keybindings.js';
import {
  drawRoidsRelative,
  moveRoids,
  spawnRoids,
  roidBelt,
} from './asteroids.js';
import {
  drawScores,
  drawLives,
  currentScore,
  newLevel,
  resetScoreLevelLives,
} from './scoreLevelLives.js';
import {
  drawGameText,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
  setTextProperties,
} from './canvas.js';
import { getMusicOn, music } from './soundsMusic.js';
import {
  drawShipRelative,
  drawShipExplosion,
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
  Ship,
} from './ship.js';
import { drawLasers, moveLasers } from './lasers.js';

let { ship, currRoidBelt } = newGame();
let nextLevel = NEXT_LEVEL_POINTS;
let gameInterval: NodeJS.Timer;

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
const el = document.getElementById('start-game');
if (!el) {
  throw Error('Could not find start game element');
}
el.addEventListener('click', startGame);
function toggleScreen(id: string, toggle: boolean): void {
  const element = document.getElementById(id);
  const display = toggle ? 'block' : 'none';
  if (element) {
    element.style.display = display;
  } else {
    throw Error(`element with id: ${id} could not be found`);
  }
}

function startGame(): void {
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);
  // Set up game loop
  gameInterval = setInterval(update, 1000 / FPS);
}

/**
 * Resets score, ship, and level for a new game.
 */
function newGame(): { ship: Ship; currRoidBelt: roidBelt } {
  resetScoreLevelLives();
  const ship = new Ship();
  const currRoidBelt = new roidBelt(ship);
  newLevel(ship, currRoidBelt);
  return { ship, currRoidBelt };
}

/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver(ship: Ship): void {
  ship.die();
  setTextProperties('Game Over', 1.0);
  music.tempo = 1.0;
}

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
    ({ ship, currRoidBelt } = newGame());
    clearInterval(gameInterval);
    if (el?.innerText) {
      el.innerText = 'Play Again! 🚀';
    } else {
      throw Error(
        'I could not access the innerText property of the start game button',
      );
    }
    toggleScreen('start-screen', true);
    toggleScreen('gameArea', false);
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

export { ship, gameOver };
