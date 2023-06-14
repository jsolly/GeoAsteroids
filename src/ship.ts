import {
  SHIP_SIZE,
  SHIP_INV_DUR,
  SHIP_INV_BLINK_DUR,
  SHIP_EXPLODE_DUR,
  SHIP_THRUST,
  LASER_MAX,
  FPS,
  START_LIVES,
  FRICTION,
  CVS,
} from './config.js';
import { Sound } from './soundsMusic.js';
import { Laser, generateLaser } from './lasers.js';
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
  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);
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
    Ship.fxExplode.play();
  }
  /**
   * As long as a ship has an explode time, it is exploding.
   */
  setExploding(): void {
    this.exploding = this.explodeTime > 0;
  }

  thrust(): void {
    if (this.thrusting && !this.dead) {
      this.xv -= (SHIP_THRUST * Math.cos(this.a)) / FPS;
      this.yv -= (SHIP_THRUST * Math.sin(this.a)) / FPS;
      Ship.fxThrust.play();

      drawThruster(this);
    } else {
      // apply friction when ship not thrusting
      this.xv -= (FRICTION * this.xv) / FPS;
      this.yv -= (FRICTION * this.yv) / FPS;
      Ship.fxThrust.stop();
    }
  }

  move(): void {
    // rotate ship
    this.a += this.rot;

    // move the ship
    this.centroid = new Point(
      this.centroid.x + this.xv,
      this.centroid.y + this.yv,
    );
  }

  // if ship can shoot and there are less than LASER_MAX on the canvas
  canShootAgain(): boolean {
    if (this.canShoot && this.lasers.length < LASER_MAX) {
      return true;
    }
    this.canShoot = false; // prevent further shooting
    return false;
  }

  shoot(): void {
    if (this.canShootAgain()) {
      this.fireLaser(); // Adds a laser to the lasers array
    }
  }
  fireLaser = (): void => {
    const laser = generateLaser(this);
    this.lasers.push(laser);
    Laser.fxLaser.play();
  };
}

export { Ship };
