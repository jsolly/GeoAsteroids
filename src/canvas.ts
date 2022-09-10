import {
  FPS,
  TEXT_SIZE,
  TEXT_FADE_TIME,
  SHIP_SIZE,
  CVS,
  CTX,
  DEBUG,
} from './config.js';
import { Point } from './utils.js';
import { Ship } from './ship.js';
import { Roid } from './asteroids.js';
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
 * Draw lasers from an array on the canvas
 */
function drawLasers(ship: Ship): void {
  for (const laser of ship.lasers) {
    const ly = laser.centroid.y;
    const lx = laser.centroid.x;
    const shipX = ship.centroid.x;
    const shipY = ship.centroid.y;
    if (laser.explodeTime == 0) {
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        SHIP_SIZE / 15,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    } else {
      // draw explosion
      CTX.fillStyle = 'orangered';
      CTX.beginPath();
      CTX.arc(
        lx - shipX + CVS.width / 2,
        ly - shipY + CVS.height / 2,
        ship.r * 0.75,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'salmon';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.5,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
      CTX.fillStyle = 'pink';
      CTX.beginPath();
      CTX.arc(
        lx - (shipX - CVS.width),
        ly - (shipY - CVS.height),
        ship.r * 0.25,
        0,
        Math.PI * 2,
        false,
      );
      CTX.fill();
    }
  }
}

/**
 * Draws astroids on the canvas from an array of Asteroids
 */
function drawRoids(roids: Roid[]): void {
  for (const roid of roids) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    const x = roid.centroid.x;
    const y = roid.centroid.y;
    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
    // draw a path
    CTX.beginPath();
    CTX.moveTo(
      x + r * offsets[0] * Math.cos(a),
      y + r * offsets[0] * Math.sin(a),
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      CTX.lineTo(
        x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
        y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices),
      );
    }
    CTX.closePath();
    CTX.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      CTX.strokeStyle = 'lime';
      CTX.beginPath();
      CTX.arc(x, y, r, 0, Math.PI * 2, false);
      CTX.stroke();
    }
  }
}
/**
 *
 * @param ship - A Ship object
 */
function drawRoidsRelative(ship: Ship, roids: Roid[]): void {
  for (const roid of roids) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    const x = CVS.width / 2 - ship.centroid.x + roid.centroid.x;
    const y = CVS.height / 2 - ship.centroid.y + roid.centroid.y;
    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
    // draw a path
    CTX.beginPath();
    CTX.moveTo(
      x + r * offsets[0] * Math.cos(a),
      y + r * offsets[0] * Math.sin(a),
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      CTX.lineTo(
        x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
        y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices),
      );
    }
    CTX.closePath();
    CTX.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      CTX.strokeStyle = 'lime';
      CTX.beginPath();
      CTX.arc(x, y, r, 0, Math.PI * 2, false);
      CTX.stroke();
    }
  }
}

/**
 * draw the ship's thruster on the canvas
 */
function drawThruster(ship: Ship): void {
  if (!ship.exploding && ship.blinkOn) {
    CTX.fillStyle = 'red';
    CTX.strokeStyle = 'yellow';
    CTX.lineWidth = SHIP_SIZE / 10;
    CTX.beginPath();
    CTX.moveTo(
      // rear left
      CVS.width / 2 +
        ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
      CVS.height / 2 +
        ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a)),
    );
    CTX.lineTo(
      // rear CENTER (behind ship)
      CVS.width / 2 + ((ship.r * 5) / 3) * Math.cos(ship.a),
      CVS.height / 2 + ((ship.r * 5) / 3) * Math.sin(ship.a),
    );
    CTX.lineTo(
      // rear right
      CVS.width / 2 +
        ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
      CVS.height / 2 +
        ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a)),
    );
    CTX.closePath();
    CTX.fill();
    CTX.stroke();
  }
}

/**
 *
 * @param ship - The current Ship
 */
function drawShipRelative(ship: Ship): void {
  /*
    An overload of drawShip that doesn't ask for the position of the ship.
    Only the angle(a)

    Inputs:
    a(number) : The angle in radians

    Outputs:
    void

    */

  const a = ship.a;
  CTX.strokeStyle = 'white';
  CTX.lineWidth = SHIP_SIZE / 20;
  CTX.beginPath();
  CTX.moveTo(
    // nose of ship
    CVS.width / 2 + (4 / 3) * ship.r * Math.cos(a + 1.06),
    CVS.height / 2 + (4 / 3) * ship.r * Math.sin(a + 1.06),
  );
  CTX.lineTo(
    // rear left
    CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) + Math.sin(a + 1.06)),
    CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) - Math.cos(a + 1.06)),
  );
  CTX.lineTo(
    // rear right
    CVS.width / 2 +
      ship.r * ((-1 / 3) * Math.cos(a + 1.06) - Math.sin(a + 1.06)),
    CVS.height / 2 +
      ship.r * ((-1 / 3) * Math.sin(a + 1.06) + Math.cos(a + 1.06)),
  );
  CTX.closePath();
  CTX.stroke();
}
/**
 * Draw the explosion when a ship is destroyed
 */
function drawShipExplosion(ship: Ship): void {
  const x = CVS.width / 2;
  const y = CVS.height / 2;
  CTX.fillStyle = 'darkred';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.7, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'red';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.4, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Orange';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 1.1, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Yellow';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 0.8, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'White';
  CTX.beginPath();
  CTX.arc(x, y, ship.r * 0.5, 0, Math.PI * 2, false);
  CTX.fill();
}

export {
  drawGameText,
  setTextProperties,
  getTextAlpha,
  drawSpace,
  drawDebugFeatures,
  drawTriangle,
  drawLasers,
  drawRoids,
  drawRoidsRelative,
  drawThruster,
  drawShipRelative,
  drawShipExplosion,
};
