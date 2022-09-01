import { FPS, TEXT_SIZE, TEXT_FADE_TIME, SHIP_SIZE } from './constants.js';
import { Point } from './utils.js';
import { Ship } from './ship.js';
let text: string;
let textAlpha: number;
const ctx = getContext();
const cvs = getCanvas();

function getCanvas(): HTMLCanvasElement {
  const cvs = document.querySelector('canvas');
  if (cvs) {
    return cvs;
  }
  throw Error('Could not get Canvas');
}

function getContext(): CanvasRenderingContext2D {
  const cvs = getCanvas();
  const ctx = cvs.getContext('2d');
  if (ctx) {
    return ctx;
  }
  throw Error('Could not get Context');
}

/**
 *
 * @param CurrenText - Text to be displayed on canvas
 * @param CurrenTextAlpha - Opacity (0-1) of text to be displayed.
 */
function setTextProperties(CurrenText: string, CurrenTextAlpha: number): void {
  text = CurrenText;
  textAlpha = CurrenTextAlpha;
}

/**
 *
 * @returns
 */
function getTextAlpha(): number {
  return textAlpha;
}

/**
 * Draws the background
 */
function drawSpace(): void {
  const ctx = getContext();
  const cvs = getCanvas();
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
}

/**
 * Draws text such as "Game Over", "Level 1." Text usually has an Alpha + fade
 * value so the text eventually disappears.
 */
function drawGameText(): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255, ' + String(textAlpha) + ')';
  ctx.font = 'small-caps ' + String(TEXT_SIZE) + 'px dejavu sans mono';
  ctx.fillText(text, cvs.width / 2, (cvs.height * 3) / 4);
  textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
}

/**
 * Draws the polygons that are used to detect collisions. Also shows you the
 * CENTER dot for the ship.
 */
function drawDebugFeatures(ship: Ship): void {
  const x = ship.centroid.x;
  const y = ship.centroid.y;
  // Draw Ship collision bounding box (if needed)
  ctx.strokeStyle = 'lime';
  ctx.beginPath();
  ctx.arc(x, y, ship.r, 0, Math.PI * 2, false);
  ctx.stroke();

  // show ship's centre dot
  ctx.fillStyle = 'red';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function drawTriangle(centroid: Point, a: number, color = 'white'): void {
  const r = SHIP_SIZE / 2;
  const x = centroid.x;
  const y = centroid.y;

  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    // nose of ship
    x + (4 / 3) * r * Math.cos(a),
    y - (4 / 3) * r * Math.sin(a),
  );
  ctx.lineTo(
    // rear left
    x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  ctx.lineTo(
    // rear right
    x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  ctx.closePath();
  ctx.stroke();
}

export {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  getContext,
  getCanvas,
  drawSpace,
  drawDebugFeatures,
  drawTriangle,
};
