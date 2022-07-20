import {FPS} from './constants.js';
import {ship} from './ship.js';

/**
 *
 * @return {
 *          {cvs:Object,
 *            ctx:Object,
 *            center:{x:number,
 *                    y:number
 *                    }
 *          }
 * } cvs is an HTMLCanvasElement and contains info about the current canvas (width, height).
 *   ctx is an object that lets you draw on the canvas
 *   The center has and x and y value which are the horizontal and vertical dimensions in pixels
 */
function getCanvConsts() {
  const canvas = <HTMLCanvasElement>document.getElementById('gameCanvas'); // Cheating a little bit https://stackoverflow.com/questions/48966233/how-do-i-solve-property-width-does-not-exist-on-type-htmlelement-when-typ
  return {
    'cvs': canvas,
    'ctx': canvas.getContext('2d'),
    'center': {x: canvas.width / 2, y: canvas.height / 2},
  };
}


/* Drawing Constants*/
const TEXT_SIZE = 40; // Text font height in pixels
const TEXT_FADE_TIME = 2.5; // text fade in seconds.

let text;
let textAlpha;
const {cvs, ctx} = getCanvConsts();
/**
 *
 * @param {string} CurrenText Text to be displayed on canvas
 * @param {number} CurrenTextAlpha Opacity (0-1) of text to be displayed.
 */
function setTextProperties(CurrenText, CurrenTextAlpha) {
  text = CurrenText;
  textAlpha = CurrenTextAlpha;
}

/**
 *
 * @return {number}
 */
function getTextAlpha() {
  return textAlpha;
}

/**
 * Draws the background
 */
function drawSpace() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
}

// function drawTriangle(
//     use_center=true,
//     location=none,
//     strokeColor='white',
//     fillColor=none) {

// }

/**
 * Draws text such as "Game Over", "Level 1." Text usually has an Alpha + fade
 * value so the text eventually disappears.
 */
function drawGameText() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255, ' + textAlpha + ')';
  ctx.font = 'small-caps ' + TEXT_SIZE + 'px dejavu sans mono';
  ctx.fillText(text, cvs.width / 2, (cvs.height * 3) / 4);
  textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
}

/**
 * Draws the polygons that are used to detect collisions. Also shows you the
 * center dot for the ship.
 */
function drawDebugFeatures() {
  // Draw Ship collision bounding box (if needed)
  ctx.strokeStyle = 'lime';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
  ctx.stroke();

  // show ship's centre dot
  ctx.fillStyle = 'red';
  ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
}

export {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  TEXT_SIZE,
  TEXT_FADE_TIME,
  getCanvConsts,
  drawSpace,
  drawDebugFeatures,
};
