import { STARTING_SCORE, SAVE_KEY_HIGH_SCORE, START_LEVEL, TEXT_SIZE, START_LIVES, SHIP_SIZE } from './constants.mjs';
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
}

function getCurrentLevel() {
    return current_level
}

function updateScores(valToAdd) {
    current_score += valToAdd
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
    ctx.fillText("BEST " + getHighScore(), canv.width / 2, 30);

}
var text, textAlpha;
function newLevel() {
    text = "Level " + (current_level + 1);
    textAlpha = 1.0
    current_level++;
    setTextProperties(text, textAlpha)
    createAsteroidBelt();

}
function getHighScore() {
    let highScore = localStorage.getItem(SAVE_KEY_HIGH_SCORE);
    if (highScore == null) {
        localStorage.setItem(SAVE_KEY_HIGH_SCORE, 0); // set high score to 0 if it is null
        return 0;
    }
    if (current_score > highScore) {
        highScore = current_score;
        localStorage.setItem(SAVE_KEY_HIGH_SCORE, highScore)
        return highScore
    } else {
        return highScore
        
    }
}
export { drawScores, drawLives, newLevel, updateScores, getCurrentLevel, resetScoreLevelLives }