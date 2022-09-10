import {
  SHIP_INV_BLINK_DUR,
  FPS,
  DEBUG,
  NEXT_LEVEL_POINTS,
  musicIsOn,
} from './config.js';
import { detectLaserHits, detectRoidHits } from './collisions.js';
import { toggleScreen, startGameBtn } from './events.js';
import { moveRoids, spawnRoids, roidBelt } from './asteroids.js';
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
  drawLasers,
  setTextProperties,
  drawShipRelative,
  drawShipExplosion,
  drawRoidsRelative,
} from './canvas.js';
import { music } from './soundsMusic.js';
import {
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
  Ship,
} from './ship.js';
import { moveLasers } from './lasers.js';

let ship: Ship;
let currRoidBelt: roidBelt;
let nextLevel = NEXT_LEVEL_POINTS;
let gameInterval: NodeJS.Timer;

function startGame(): void {
  newGame();
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);
  // Set up game loop
  gameInterval = setInterval(update, 1000 / FPS);
}

/**
 * Resets score, ship, and level for a new game.
 */
function newGame(): void {
  resetScoreLevelLives();
  ship = new Ship();
  currRoidBelt = new roidBelt(ship);
  newLevel(ship, currRoidBelt);
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
    newGame();
    clearInterval(gameInterval);
    startGameBtn.innerText = 'Play Again! 🚀';

    toggleScreen('start-screen', true);
    toggleScreen('gameArea', false);
  }

  // tick the music
  if (musicIsOn()) {
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

export { ship, gameOver, startGame };
