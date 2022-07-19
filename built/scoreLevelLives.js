import { STARTING_SCORE, SAVE_KEY_HIGH_SCORE, START_LEVEL, SHIP_SIZE, } from './constants.js';
import { setTextProperties, GAME_CANVAS, GAME_CONTEXT, TEXT_SIZE, } from './canvas.js';
import { drawShip, ship } from './ship.js';
import { createAsteroidBelt } from './asteroids.js';
let currentScore = STARTING_SCORE;
let currentLevel = START_LEVEL;
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
        drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColor);
    }
}
/**
 * Draw current score and high score on canvas
 */
function drawScores() {
    const ctx = GAME_CONTEXT;
    const cvs = GAME_CANVAS;
    // draw the score
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.font = TEXT_SIZE + 'px dejavu sans mono';
    ctx.fillText(currentScore, cvs.width - 15, 30);
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
    let highScore = localStorage.getItem(SAVE_KEY_HIGH_SCORE);
    if (highScore == null) {
        localStorage.setItem(SAVE_KEY_HIGH_SCORE, 0); // set to 0 if null
        return 0;
    }
    if (currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem(SAVE_KEY_HIGH_SCORE, highScore);
        return highScore;
    }
    else {
        return highScore;
    }
}
export { drawScores, drawLives, newLevel, updateScores, getCurrentLevel, resetScoreLevelLives, };
