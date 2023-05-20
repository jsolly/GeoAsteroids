import {
  SHIP_INV_BLINK_DUR,
  FPS,
  DEBUG,
  NEXT_LEVEL_POINTS,
  musicIsOn,
  STARTING_SCORE,
  START_LEVEL,
} from './config.js';
import { detectLaserHits, detectRoidHits } from './collisions.js';
import { toggleScreen, startGameBtn } from './events.js';
import { moveRoids, spawnRoids, roidBelt } from './asteroids.js';
import {
  drawGameText,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
  setTextProperties,
  drawScores,
  drawLives,
  newLevelText,
} from './canvas.js';
import { music } from './soundsMusic.js';
import { thrustShip, moveShip, Ship } from './ship.js';
import { moveLasers } from './lasers.js';
import { drawShipRelative, drawShipExplosion } from './shipCanv.js';
import { drawLasers } from './lasersCanv.js';
import { drawRoidsRelative } from './asteroidsCanv.js';
import { updatePersonalBest } from './utils.js';

let ship: Ship;
let currRoidBelt: roidBelt;
let nextLevel = NEXT_LEVEL_POINTS;
let gameInterval: NodeJS.Timer;
let currScore = STARTING_SCORE;
let currLevel = START_LEVEL;

interface HighScore {
  name: string;
  currScore: number;
}

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
  ship = new Ship();
  currRoidBelt = new roidBelt(ship);
  currScore = STARTING_SCORE;
  currLevel = START_LEVEL;
  newLevel(ship, currRoidBelt);
}

/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function newLevel(ship: Ship, currRoidBelt: roidBelt): void {
  currLevel += 1;
  newLevelText(currLevel);
  currRoidBelt.addRoid(ship);
  music.setMusicTempo(currLevel);
}

function updateCurrScore(valtoAdd: number): void {
  currScore += valtoAdd;
}

/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver(ship: Ship): void {
  ship.die();
  setTextProperties('Game Over', 1.0);
  music.tempo = 1.0;
}

async function showGameOverMenu(): Promise<void> {
  const name = prompt('Enter your name for the high score list:');
  if (name != null) {
    // Call Serverside API to save score
    const highScore: HighScore = { name, currScore };
    try {
      const response = await fetch('/api/highscores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(highScore),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
    } catch (error) {
      console.error(
        'There has been a problem with your fetch operation:',
        error,
      );
    }
  }

  newGame();
  clearInterval(gameInterval);
  startGameBtn.innerText = 'Play Again! 🚀';

  toggleScreen('start-screen', true);
  toggleScreen('gameArea', false);
}

/**
 * Runs the game. Called every frame to move the game forward.
 */
function update(): void {
  updatePersonalBest(currScore);
  if (currScore > nextLevel) {
    newLevel(ship, currRoidBelt);
    nextLevel += 1000;
  }
  const roids = currRoidBelt.roids;
  spawnRoids(currRoidBelt, ship);

  if (DEBUG) {
    drawDebugFeatures(ship);
  }

  ship.setBlinkOn();
  ship.setExploding();
  drawSpace();
  drawRoidsRelative(ship, roids);
  drawScores(currScore);
  drawLives(ship);

  if (getTextAlpha() >= 0) {
    drawGameText();
  } else if (ship.dead) {
    showGameOverMenu().catch((error) =>
      console.error('Error in showGameOverMenu:', error),
    );
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

export {
  ship,
  gameOver,
  startGame,
  currScore,
  currLevel,
  updateCurrScore,
  newLevel,
};
