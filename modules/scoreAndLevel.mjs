import { STARTING_SCORE, SAVE_KEY_SCORE, START_LEVEL } from './constants.mjs';
var current_score = STARTING_SCORE
var current_level = START_LEVEL
function getCurrentHighScore() {
    // get the high score from local storage
    var scoreStr = localStorage.getItem(SAVE_KEY_SCORE);
    if (scoreStr == null) {
        scoreHigh = 0;
    } else {
        scoreHigh = parseInt(scoreStr)
    }
}

function getCurrentLevel(){
    return current_level
}

function updateScores(valToAdd){
    current_score += valToAdd
      checkHighScore();
}

function drawScores(ctx, canv, text_size) {
    // draw the score
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = text_size + "px dejavu sans mono";
    ctx.fillText(current_score, canv.width - 15, 30);


    // draw the high score
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = (text_size * 0.75) + "px dejavu sans mono";
    ctx.fillText("BEST " + scoreHigh, canv.width / 2, 30);

}
var text, textAlpha;
function newLevel() {
    text = "Level " + (current_level + 1);
    textAlpha = 1.0
    current_level++;
}
var scoreHigh;
function checkHighScore() {
    if (current_score > scoreHigh) {
        scoreHigh = current_score;
        localStorage.setItem(SAVE_KEY_SCORE, scoreHigh)
    }
}
export { getCurrentHighScore, drawScores, newLevel, checkHighScore, updateScores, getCurrentLevel }