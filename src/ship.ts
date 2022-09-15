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
} from './config.js';
import { fxExplode, fxThrust } from './soundsMusic.js';
import { Laser } from './lasers.js';
import { Point } from './utils.js';
import { drawThruster } from './shipCanv.js';

/**
 *
 */
class Ship {
  centroid = new Point(CVS.width / 2, CVS.height / 2);
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

  die(): void {
    this.dead = true;
  }

  /**
   * Set ship to blinking (invulnerable)
   */
  setBlinkOn(): void {
    this.blinkOn = this.blinkCount % 2 == 0;
  }
  /**
   * Set ship explode time. It will explode for SHIP_EXPLODE_DUR
   */
  explode(): void {
    this.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
    this.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
    fxExplode.play();
  }
  /**
   * As long as a ship has an explode time, it is exploding.
   */
  setExploding(): void {
    this.exploding = this.explodeTime > 0;
  }
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

export { thrustShip, moveShip, Ship };
