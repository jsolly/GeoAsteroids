import {SHIP_SIZE, SHIP_INV_DUR, SHIP_INV_BLINK_DUR, SHIP_EXPLODE_DUR, SHIP_THRUST, FPS, START_LIVES, FRICTION} from './constants.js';
import {fxExplode, fxThrust} from './soundsMusic.js';
import {GAME_CANVAS, GAME_CONTEXT, GAME_CENTER} from './canvas.js';
const ctx = GAME_CONTEXT;
const cvs = GAME_CANVAS;
let ship = {
  x: GAME_CENTER.x,
  y: GAME_CENTER.y,
  t: 0,
  xv: 0,
  yv: 0,
  r: SHIP_SIZE / 2,
  a: (90 / 180) * Math.PI,
  blinkCount: Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR),
  blinkTime: Math.ceil(SHIP_INV_BLINK_DUR * FPS),
  blinkOn: false,
  canShoot: true,
  dead: false,
  exploding: false,
  lives: START_LIVES,
  lasers: [],
  explodeTime: 0,
  rot: 0,
  thrusting: false,
};
/**
 *
 * @param {number} currentLives - Current lives (1-CURRENT_LIVES)
 * @param {Boolean} currentBlinkOn - Whether the ship is blinking or not.
 */
function resetShip(currentLives = START_LIVES, currentBlinkOn = false) {
  ship = {
    x: GAME_CENTER.x,
    y: GAME_CENTER.y,
    t: 0,
    xv: 0,
    yv: 0,
    r: SHIP_SIZE / 2,
    a: (90 / 180) * Math.PI,
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
  const ctx = GAME_CONTEXT;
  const cvs = GAME_CANVAS;
  if (!ship.exploding && ship.blinkOn) {
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = SHIP_SIZE / 10;
    ctx.beginPath();
    ctx.moveTo(
        // rear left
        cvs.width / 2 +
            ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)), cvs.height / 2 +
            ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a)));
    ctx.lineTo(
        // rear center (behind ship)
        cvs.width / 2 + ((ship.r * 5) / 3) * Math.cos(ship.a), cvs.height / 2 + ((ship.r * 5) / 3) * Math.sin(ship.a));
    ctx.lineTo(
        // rear right
        cvs.width / 2 +
            ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)), cvs.height / 2 +
            ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
/**
 *
 * @param {number} x - Ship's x coordinate
 * @param {number} y
 * @param {number} a
 * @param {string} color
 */
function drawShip(x, y, a, color = 'white') {
  const ctx = GAME_CONTEXT;
  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
      // nose of ship
      x + (4 / 3) * ship.r * Math.cos(a), y - (4 / 3) * ship.r * Math.sin(a));
  ctx.lineTo(
      // rear left
      x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)), y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a)));
  ctx.lineTo(
      // rear right
      x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)), y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a)));
  ctx.closePath();
  ctx.stroke();
}
/**
 *
 * @param {number} a - Angle of the ship in radians
 * @param {string} color - Color of the ship
 */
function drawShipRelative(a, color = 'white') {
  /*
      An overload of drawShip that doesn't ask for the position of the ship.
      Only the angle(a)

      Inputs:
      a(number) : The angle in radians

      Outputs:
      void

      */
  ctx.strokeStyle = color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
      // nose of ship
      cvs.width / 2 + (4 / 3) * ship.r * Math.cos(a + 1.06), cvs.height / 2 + (4 / 3) * ship.r * Math.sin(a + 1.06));
  ctx.lineTo(
      // rear left
      cvs.width / 2 +
        ship.r * ((-1 / 3) * Math.cos(a + 1.06) + Math.sin(a + 1.06)), cvs.height / 2 +
        ship.r * ((-1 / 3) * Math.sin(a + 1.06) - Math.cos(a + 1.06)));
  ctx.lineTo(
      // rear right
      cvs.width / 2 +
        ship.r * ((-1 / 3) * Math.cos(a + 1.06) - Math.sin(a + 1.06)), cvs.height / 2 +
        ship.r * ((-1 / 3) * Math.sin(a + 1.06) + Math.cos(a + 1.06)));
  ctx.closePath();
  ctx.stroke();
}
/**
 * Draw the explosion when a ship is destroyed
 */
function drawShipExplosion() {
  const ctx = GAME_CONTEXT;
  ctx.fillStyle = 'darkred';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'Orange';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'Yellow';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'White';
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2, false);
  ctx.fill();
}
export {resetShip, drawShip, drawShipRelative, drawShipExplosion, explodeShip, killShip, drawThruster, thrustShip, moveShip, setBlinkOn, setExploding, ship};
