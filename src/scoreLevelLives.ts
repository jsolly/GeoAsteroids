import {
  STARTING_SCORE,
  SAVE_KEY_HIGH_SCORE,
  START_LEVEL,
  SHIP_SIZE,
} from './constants.js';
import {
  setTextProperties,
  TEXT_SIZE,
  getCanvConsts,
} from './canvas.js';
import {drawShip, ship} from './ship.js';
import {createAsteroidBelt} from './asteroids.js';
let currentScore = STARTING_SCORE;
let currentLevel = START_LEVEL;
const {cvs, ctx} = getCanvConsts();

/**
 * Set score, level, lives, back to default (called inside gameOver())
 */
function resetScoreLevelLives() {
  currentScore = STARTING_SCORE;
  currentLevel = START_LEVEL;
}

/**
 * @return {number} Return current level (0-infinity)
 */
function getCurrentLevel() {
  return currentLevel;
}

/**
 *
 * @param {number} valToAdd - A score to add to the current score.
 * Called when the user does something to get points such as
 * destroying an asteroid
 */
function updateScores(valToAdd) {
  currentScore += valToAdd;
}
/**
 * Draw number of lives left on canvas
 */
function drawLives() {
  let lifeColor;
  for (let i = 0; i < ship.lives; i++) {
    lifeColor = ship.exploding && i == ship.lives - 1 ? 'red' : 'white';
    drawShip(
        SHIP_SIZE + i * SHIP_SIZE * 1.2,
        SHIP_SIZE,
        0.5 * Math.PI,
        lifeColor,
    );
  }
}

/**
 * Draw current score and high score on canvas
 */
function drawScores() {
  // draw the score
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = TEXT_SIZE + 'px dejavu sans mono';
  ctx.fillText(String(currentScore), cvs.width - 15, 30);

  // draw the high score
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.font = TEXT_SIZE * 0.75 + 'px dejavu sans mono';
  ctx.fillText('BEST ' + getHighScore(), cvs.width / 2, 30);
}
let text;
let textAlpha;
/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function newLevel() {
  text = 'Level ' + (currentLevel + 1);
  textAlpha = 1.0;
  currentLevel++;
  setTextProperties(text, textAlpha);
  createAsteroidBelt();
}
/**
 *
 * @return {number} - The current high score.
 */
function getHighScore() {
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
  resetScoreLevelLives,
};
