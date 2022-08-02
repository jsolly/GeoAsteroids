import { FPS, CTX, CVS, TEXT_SIZE, TEXT_FADE_TIME } from './constants.js';
import { ship } from './ship.js';

let text: string;
let textAlpha: number;

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
  CTX.fillStyle = 'black';
  CTX.fillRect(0, 0, CVS.width, CVS.height);
}

/**
 * Draws text such as "Game Over", "Level 1." Text usually has an Alpha + fade
 * value so the text eventually disappears.
 */
function drawGameText(): void {
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  CTX.fillStyle = 'rgba(255,255,255, ' + String(textAlpha) + ')';
  CTX.font = 'small-caps ' + String(TEXT_SIZE) + 'px dejavu sans mono';
  CTX.fillText(text, CVS.width / 2, (CVS.height * 3) / 4);
  textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
}

/**
 * Draws the polygons that are used to detect collisions. Also shows you the
 * CENTER dot for the ship.
 */
function drawDebugFeatures(): void {
  // Draw Ship collision bounding box (if needed)
  CTX.strokeStyle = 'lime';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
  CTX.stroke();

  // show ship's centre dot
  CTX.fillStyle = 'red';
  CTX.fillRect(ship.x - 1, ship.y - 1, 2, 2);
}

export {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
};
