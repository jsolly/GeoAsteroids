import { STARTING_SCORE, SAVE_KEY_SCORE, START_LEVEL, TEXT_SIZE, START_LIVES, SHIP_SIZE } from './constants.mjs';
import { getCanv, getCTX, setTextProperties } from './canvas.mjs';
import { drawShip, getShip } from './ship.mjs';
import { createAsteroidBelt } from './asteroids.mjs';
var current_score = STARTING_SCORE
var current_level = START_LEVEL
var current_lives = START_LIVES

function resetScoreLevelLives(){
    current_score = STARTING_SCORE
    current_level = START_LEVEL
    current_lives = START_LIVES
    getCurrentHighScore();
}

function getCurrentHighScore() {
    // get the high score from local storage
    var scoreStr = localStorage.getItem(SAVE_KEY_SCORE);
    if (scoreStr == null) {
        scoreHigh = 0;
    } else {
        scoreHigh = parseInt(scoreStr)
    }
}

function getCurrentLevel() {
    return current_level
}

function updateScores(valToAdd) {
    current_score += valToAdd
    checkHighScore();
}

function drawLives() {
    let ship = getShip();
    let lifeColor;
    for (var i = 0; i < ship.lives; i++) {
        lifeColor = ship.exploding && i == ship.lives - 1 ? "red" : "white";
        drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColor);

    }
}

function drawScores() {
    let ctx = getCTX();
    let canv = getCanv();
    // draw the score
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = TEXT_SIZE + "px dejavu sans mono";
    ctx.fillText(current_score, canv.width - 15, 30);


    // draw the high score
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = (TEXT_SIZE * 0.75) + "px dejavu sans mono";
    ctx.fillText("BEST " + scoreHigh, canv.width / 2, 30);

}
var text, textAlpha;
function newLevel() {
    text = "Level " + (current_level + 1);
    textAlpha = 1.0
    current_level++;
    setTextProperties(text, textAlpha)
    createAsteroidBelt();

}
var scoreHigh;
function checkHighScore() {
    if (current_score > scoreHigh) {
        scoreHigh = current_score;
        localStorage.setItem(SAVE_KEY_SCORE, scoreHigh)
    }
}
export { getCurrentHighScore, drawScores, drawLives, newLevel, checkHighScore, updateScores, getCurrentLevel, resetScoreLevelLives }