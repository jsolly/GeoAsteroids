import {
  SHIP_SIZE,
  SHIP_INV_DUR,
  SHIP_INV_BLINK_DUR,
  SHIP_EXPLODE_DUR,
  SHIP_THRUST,
  FPS,
  START_LIVES,
  FRICTION,
  CVS,
  CTX,
} from './constants.js';
import {fxExplode, fxThrust} from './soundsMusic.js';
import {laser} from './lasers.js';

/**
 *
 */
class Ship {
  x: number = CVS.width;
  y: number = CVS.height;
  t = 0;
  xv = 0;
  yv = 0;
  readonly r: number = SHIP_SIZE / 2; // radius in pixels
  a: number = (90 / 180) * Math.PI; // convert to radians;
  blinkCount: number = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  blinkTime: number = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  blinkOn: boolean;
  canShoot = true;
  dead = false;
  exploding = false;
  lives: number;
  lasers: typeof laser[] = [];
  explodeTime = 0;
  rot = 0;
  thrusting = false;
  /**
   *
   * @param {number} lives - Create a ship with a given number of lives
   * @param {boolean} blinkOn - Determine if ship should be blinking or not
   */
  constructor(lives:number=START_LIVES, blinkOn = false) {
    this.lives = lives;
    this.blinkOn = blinkOn;
  }
}
const blinkOn = false;
const lives = START_LIVES;
let ship = new Ship(lives, blinkOn);

/**
 *
 * @param {number} currentLives - Current lives (1-CURRENT_LIVES)
 * @param {Boolean} currentBlinkOn - Whether the ship is blinking or not
 */
function resetShip(currentLives = START_LIVES, currentBlinkOn = false) {
  ship = {
    x: CVS.width,
    y: CVS.height,
    t: 0,
    xv: 0,
    yv: 0,
    r: SHIP_SIZE / 2,
    a: (90 / 180) * Math.PI, // convert to radians
    blinkCount: Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR),
    blinkTime: Math.ceil(SHIP_INV_BLINK_DUR * FPS),
    blinkOn: currentBlinkOn,
    canShoot: true,
    dead: false,
    exploding: false,
    lives: currentLives,
    lasers: [],
    explodeTime: 0,
    rot: 0,
    thrusting: false,
  };
}

/**
 * Switch ship into a dead state. This ends the game.
 */
function killShip() {
  ship.dead = true;
}

/**
 * Set ship to blinking (invulnerable)
 */
function setBlinkOn() {
  ship.blinkOn = ship.blinkCount % 2 == 0;
}

/**
 * As long as a ship has an explode time, it is exploding.
 */
function setExploding() {
  ship.exploding = ship.explodeTime > 0;
}
/**
 * Set ship explode time. It will explode for SHIP_EXPLODE_DUR
 */
function explodeShip() {
  ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
  fxExplode.play();
}

/**
 * Add/remove from ship's x and y velocity. Make sure the thruster is drawn.
 */
function thrustShip() {
  if (ship.thrusting && !ship.dead) {
    ship.xv -= (SHIP_THRUST * Math.cos(ship.a)) / FPS;
    ship.yv -= (SHIP_THRUST * Math.sin(ship.a)) / FPS;
    fxThrust.play();

    drawThruster();
  } else {
    // apply friction when ship not thrusting
    ship.xv -= (FRICTION * ship.xv) / FPS;
    ship.yv -= (FRICTION * ship.yv) / FPS;
    fxThrust.stop();
  }
}
/**
 * Move ship based on its x and y velocity
 */
function moveShip() {
  // rotate ship
  ship.a += ship.rot;

  // move the ship
  ship.x += ship.xv;
  ship.y += ship.yv;
}

/**
 * draw the ship's thruster on the canvas
 */
function drawThruster() {
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
 * @param {number} x - Ship's x coordinate
 * @param {number} y
 * @param {number} a
 * @param {string} color
 */
function drawShip(x:number, y:number, a:number, color = 'white') {
  CTX.strokeStyle = color;
  CTX.lineWidth = SHIP_SIZE / 20;
  CTX.beginPath();
  CTX.moveTo(
      // nose of ship
      x + (4 / 3) * ship.r * Math.cos(a),
      y - (4 / 3) * ship.r * Math.sin(a),
  );
  CTX.lineTo(
      // rear left
      x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  CTX.lineTo(
      // rear right
      x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  CTX.closePath();
  CTX.stroke();
}
/**
 *
 * @param {number} a - Angle of the ship in radians
 * @param {string} color - Color of the ship
 */
function drawShipRelative(a:number, color = 'white') {
  /*
    An overload of drawShip that doesn't ask for the position of the ship.
    Only the angle(a)

    Inputs:
    a(number) : The angle in radians

    Outputs:
    void

    */

  CTX.strokeStyle = color;
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
function drawShipExplosion() {
  CTX.fillStyle = 'darkred';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'red';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Orange';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'Yellow';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2, false);
  CTX.fill();
  CTX.fillStyle = 'White';
  CTX.beginPath();
  CTX.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2, false);
  CTX.fill();
}
export {
  resetShip,
  drawShip,
  drawShipRelative,
  drawShipExplosion,
  explodeShip,
  killShip,
  drawThruster,
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
  Ship,
  ship,
};
