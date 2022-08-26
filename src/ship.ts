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
import { fxExplode, fxThrust } from './soundsMusic.js';
import { Laser } from './lasers.js';
import { Point } from './utils.js';

/**
 *
 */
class Ship {
  centroid = new Point(CVS.width, CVS.height);
  t = 0;
  xv = 0;
  yv = 0;
  readonly r: number = SHIP_SIZE / 2;
  a: number = (90 / 180) * Math.PI; // convert to radians;
  blinkCount: number = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  blinkTime: number = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  canShoot = true;
  dead = false;
  exploding = false;
  lasers: Laser[] = [];
  explodeTime = 0;
  rot = 0;
  thrusting = false;
  /**
   *
   * @param lives - Create a ship with a given number of lives
   * @param blinkOn - Determine if ship should be blinking or not
   */
  constructor(
    public lives: number = START_LIVES,
    public blinkOn: boolean = false,
  ) {}
}

/**
 *
 * @param currentLives - Current lives (1-CURRENT_LIVES)
 * @param currentBlinkOn - Whether the ship is blinking or not
 */
function resetShip(currentLives = START_LIVES, currentBlinkOn = false): Ship {
  return new Ship(currentLives, currentBlinkOn);
}

function newShip(): Ship {
  return new Ship();
}
/**
 * Switch ship into a dead state. This ends the game.
 */
function killShip(ship: Ship): void {
  ship.dead = true;
}

/**
 * Set ship to blinking (invulnerable)
 */
function setBlinkOn(ship: Ship): void {
  ship.blinkOn = ship.blinkCount % 2 == 0;
}

/**
 * As long as a ship has an explode time, it is exploding.
 */
function setExploding(ship: Ship): void {
  ship.exploding = ship.explodeTime > 0;
}
/**
 * Set ship explode time. It will explode for SHIP_EXPLODE_DUR
 */
function explodeShip(ship: Ship): void {
  ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
  ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  fxExplode.play();
}

/**
 * Add/remove from ship's x and y velocity. Make sure the thruster is drawn.
 */
function thrustShip(ship: Ship): void {
  if (ship.thrusting && !ship.dead) {
    ship.xv -= (SHIP_THRUST * Math.cos(ship.a)) / FPS;
    ship.yv -= (SHIP_THRUST * Math.sin(ship.a)) / FPS;
    fxThrust.play();

    drawThruster(ship);
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
function moveShip(ship: Ship): void {
  // rotate ship
  ship.a += ship.rot;

  // move the ship
  ship.centroid = new Point(
    ship.centroid.x + ship.xv,
    ship.centroid.y + ship.yv,
  );
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
  const x = ship.centroid.x;
  const y = ship.centroid.y;
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
  resetShip,
  drawShipRelative,
  drawShipExplosion,
  explodeShip,
  killShip,
  drawThruster,
  thrustShip,
  moveShip,
  setBlinkOn,
  setExploding,
  newShip,
  Ship,
};
