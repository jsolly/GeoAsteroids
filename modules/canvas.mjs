import { TEXT_FADE_TIME, TEXT_SIZE, FPS } from './constants.mjs';
var text, textAlpha;

//** @type {HTMLCanvasElement} */
var canv = document.getElementById("gameCanvas");
var ctx = canv.getContext("2d");

function setTextProperties(current_text, current_textAlpha) {
    text = current_text
    textAlpha = current_textAlpha

}

function getTextAlpha() {
    return textAlpha
}

function getCanv() {
    return canv
}

function getCTX() {
    return ctx
}

function drawSpace() {
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canv.width, canv.height);
}


function drawGameText() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255, " + textAlpha + ")";
    ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
    ctx.fillText(text, canv.width / 2, canv.height * 3 / 4);
    textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
}

function drawDebugFeatures() {
    // Draw Ship collision bounding box (if needed)
    ctx.strokeStyle = "lime";
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
    ctx.stroke();


    // show ship's centre dot
    ctx.fillStyle = "red";
    ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
}

export { drawGameText, setTextProperties, getTextAlpha, getCTX, getCanv, drawSpace, drawDebugFeatures }