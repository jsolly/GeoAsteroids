import { TEXT_FADE_TIME, TEXT_SIZE, FPS } from './constants.mjs';

var text, textAlpha;
function setTextProperties(current_text, current_textAlpha) {
    text = current_text
    textAlpha = current_textAlpha

}


function drawGameText(ship, ctx, canv) {
    if (textAlpha >= 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255, " + textAlpha + ")";
        ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
        ctx.fillText(text, canv.width / 2, canv.height * 3 / 4);
        textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
    } else if (ship.dead) {
        newGame();
    }
    return textAlpha
}
var lives;
function drawLives() {
    let lifeColor;
    for (var i = 0; i < lives; i++) {
        lifeColor = exploding && i == lives - 1 ? "red" : "white";
        drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColor);

    }
}

export { drawGameText, setTextProperties, drawLives }