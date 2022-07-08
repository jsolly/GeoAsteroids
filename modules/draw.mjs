import { TEXT_FADE_TIME, TEXT_SIZE, FPS } from './constants.mjs';
var text, textAlpha;
function setTextProperties(current_text, current_textAlpha) {
    text = current_text
    textAlpha = current_textAlpha

}

function getTextAlpha(){
    return textAlpha
}


function drawGameText(ctx, canv) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255, " + textAlpha + ")";
    ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
    ctx.fillText(text, canv.width / 2, canv.height * 3 / 4);
    textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
}

export { drawGameText, setTextProperties, getTextAlpha }