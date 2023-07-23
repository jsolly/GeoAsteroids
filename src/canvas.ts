import {
  FPS,
  TEXT_SIZE,
  TEXT_FADE_TIME,
  SHIP_SIZE,
  CVS,
  CTX,
  DEBUG,
} from './constants';
import { Ship } from './ship';
import { Point } from './utils';
import { drawRoidsRelative } from './asteroidsCanv';
import { drawLasers } from './shipCanv';
import { showGameOverMenu } from './mainMenu';
import { RoidBelt } from './asteroids';

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
function drawDebugFeatures(ship: Ship): void {
  const x = ship.centroid.x;
  const y = ship.centroid.y;
  // Draw Ship collision bounding box (if needed)
  CTX.strokeStyle = 'lime';
  CTX.beginPath();
  CTX.arc(x, y, ship.r, 0, Math.PI * 2, false);
  CTX.stroke();

  // show ship's centre dot
  CTX.fillStyle = 'red';
  CTX.fillRect(x - 1, y - 1, 2, 2);
}

function drawTriangle(centroid: Point, a: number, color = 'white'): void {
  const r = SHIP_SIZE / 2;
  const x = centroid.x;
  const y = centroid.y;

  CTX.strokeStyle = color;
  CTX.lineWidth = SHIP_SIZE / 20;
  CTX.beginPath();
  CTX.moveTo(
    // nose of ship
    x + (4 / 3) * r * Math.cos(a),
    y - (4 / 3) * r * Math.sin(a),
  );
  CTX.lineTo(
    // rear left
    x - r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  CTX.lineTo(
    // rear right
    x - r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y + r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  CTX.closePath();
  CTX.stroke();
}

/**
 * Draw number of lives left on canvas
 */
function drawLives(ship: Ship): void {
  let lifeColor;
  for (let i = 0; i < ship.lives; i++) {
    lifeColor = getLifeColor(ship);
    const lifeCentroid = new Point(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE);
    drawTriangle(lifeCentroid, 0.5 * Math.PI, lifeColor);
  }
}

function getLifeColor(ship: Ship): string {
  const currLives = ship.lives;
  return ship.exploding && currLives == ship.lives - 1 ? 'red' : 'white';
}

/**
 * Draw current score and high score on canvas
 */
function drawScores(score: number, personalBest: number): void {
  // draw the score
  CTX.textAlign = 'right';
  CTX.textBaseline = 'middle';
  CTX.fillStyle = 'white';
  CTX.font = String(TEXT_SIZE) + 'px dejavu sans mono';
  CTX.fillText(String(score), CVS.width - 15, 30);

  // draw the personal best
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  CTX.fillStyle = 'white';
  CTX.font = String(TEXT_SIZE * 0.75) + 'px dejavu sans mono';
  CTX.fillText('BEST ' + String(personalBest), CVS.width / 2, 30);
}

/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function newLevelText(currentLevel: number): void {
  text = 'Level ' + String(currentLevel);
  textAlpha = 1.0;
  setTextProperties(text, textAlpha);
}

function drawGameCanvas(
  ship: Ship,
  roidBelt: RoidBelt,
  currScore: number,
  personalBest: number,
): void {
  drawSpace();
  roidBelt.spawnRoids(ship);

  if (DEBUG) {
    drawDebugFeatures(ship);
  }

  drawRoidsRelative(ship, roidBelt.roids);
  drawLasers(ship);
  drawScores(currScore, personalBest);
  drawLives(ship);

  if (getTextAlpha() >= 0) {
    drawGameText();
  } else if (ship.dead) {
    showGameOverMenu();
  }
}

export { drawSpace, newLevelText, setTextProperties, drawGameCanvas };
