import {
  STARTING_SCORE,
  SAVE_KEY_HIGH_SCORE,
  START_LEVEL,
  SHIP_SIZE,
  CVS,
  CTX,
  TEXT_SIZE
} from './constants.js';
import { setTextProperties } from './canvas.js';
import { drawShip, ship } from './ship.js';
import { createAsteroidBelt } from './asteroids.js';
let currentScore = STARTING_SCORE;
let currentLevel = START_LEVEL;

/**
 * Set score, level, lives, back to default (called inside gameOver())
 */
function resetScoreLevelLives(): void {
  currentScore = STARTING_SCORE;
  currentLevel = START_LEVEL;
}

/**
 * @returns Return current level (0-infinity)
 */
function getCurrentLevel(): number {
  return currentLevel;
}

/**
 *
 * @param valToAdd - A score to add to the current score.
 * Called when the user does something to get points such as
 * destroying an asteroid
 */
function updateScores(valToAdd: number): void {
  currentScore += valToAdd;
}
/**
 * Draw number of lives left on canvas
 */
function drawLives(): void {
  let lifeColor;
  for (let i = 0; i < ship.lives; i++) {
    lifeColor = ship.exploding && i == ship.lives - 1 ? 'red' : 'white';
    drawShip(
      SHIP_SIZE + i * SHIP_SIZE * 1.2,
      SHIP_SIZE,
      0.5 * Math.PI,
      lifeColor
    );
  }
}

/**
 * Draw current score and high score on canvas
 */
function drawScores(): void {
  // draw the score
  CTX.textAlign = 'right';
  CTX.textBaseline = 'middle';
  CTX.fillStyle = 'white';
  CTX.font = TEXT_SIZE + 'px dejavu sans mono';
  CTX.fillText(String(currentScore), CVS.width - 15, 30);

  // draw the high score
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  CTX.fillStyle = 'white';
  CTX.font = TEXT_SIZE * 0.75 + 'px dejavu sans mono';
  CTX.fillText('BEST ' + getHighScore(), CVS.width / 2, 30);
}
let text;
let textAlpha;
/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function newLevel(): void {
  text = 'Level ' + (currentLevel + 1);
  textAlpha = 1.0;
  currentLevel++;
  setTextProperties(text, textAlpha);
  createAsteroidBelt();
}
/**
 *
 * @returns - The current high score.
 */
function getHighScore(): number {
  const highScore = localStorage.getItem(SAVE_KEY_HIGH_SCORE);
  if (highScore == null) {
    localStorage.setItem(SAVE_KEY_HIGH_SCORE, '0'); // set to 0 if null
    return 0;
  }
  let numberHighScore = Number(highScore);
  if (currentScore > numberHighScore) {
    numberHighScore = currentScore;
    localStorage.setItem(SAVE_KEY_HIGH_SCORE, String(numberHighScore));
    return numberHighScore;
  } else {
    return numberHighScore;
  }
}
export {
  drawScores,
  drawLives,
  newLevel,
  updateScores,
  getCurrentLevel,
  resetScoreLevelLives
};
