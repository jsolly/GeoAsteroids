import {
  FPS,
  LASER_EXPLODE_DUR,
  LASER_DIST,
  CVS,
  SHIP_EXPLODE_DUR,
  SHIP_INV_DUR,
  SHIP_SIZE,
  SHIP_THRUST,
  START_LIVES,
  SHIP_INV_BLINK_DUR,
  LASER_SPEED,
  LASER_MAX,
  FRICTION,
} from './config.js';
import { Sound } from './soundsMusic.js';
import { drawThruster } from './shipCanv.js';
import { Point } from './utils.js';

class Laser {
  static fxLaser = new Sound('sounds/laser.m4a', 5);
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public centroid: Point,
    public xv: number,
    public yv: number,
    public distTraveled: number,
    public explodeTime: number,
  ) {}
}

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
  applyVelocity(): void {
    if (this.thrusting && !this.dead) {
      this.xv -= (SHIP_THRUST * Math.cos(this.a)) / FPS;
      this.yv -= (SHIP_THRUST * Math.sin(this.a)) / FPS;

      drawThruster(this);
    } else {
      // apply friction when ship not thrusting
      this.xv -= (FRICTION * this.xv) / FPS;
      this.yv -= (FRICTION * this.yv) / FPS;
    }
  }

  move(): void {
    // rotate ship
    this.a += this.rot;

    // apply velocity
    this.applyVelocity();

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
    const laser = this.generateLaser();
    this.lasers.push(laser);
    Laser.fxLaser.play();
  };
  moveLasers(): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];

      // check laser distance
      if (laser.distTraveled > LASER_DIST * CVS.width) {
        this.lasers.splice(i, 1);
        continue;
      }

      // handle the explosion
      if (laser.explodeTime > 0) {
        laser.explodeTime--;

        if (laser.explodeTime == 0) {
          this.lasers.splice(i, 1);
          continue;
        }
      } else {
        laser.centroid = new Point(
          laser.centroid.x + laser.xv,
          laser.centroid.y + laser.yv,
        );

        // calculate distance traveled
        laser.distTraveled += 0.5;
      }
    }
  }

  updateLaserExplodeTime(i: number): void {
    this.lasers[i].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
  }

  generateLaser(): Laser {
    const xv: number = (-LASER_SPEED * Math.cos(-this.a)) / FPS + this.xv;
    const yv: number = (LASER_SPEED * Math.sin(-this.a)) / FPS + this.yv;

    const noseX =
      this.centroid.x +
      this.r * ((-1 / 3) * Math.cos(this.a + 1.06) - Math.sin(this.a + 1.06));
    const noseY =
      this.centroid.y +
      this.r * ((-1 / 3) * Math.sin(this.a + 1.06) + Math.cos(this.a + 1.06));

    const laserStartPoint = new Point(noseX, noseY);

    const laser = new Laser(laserStartPoint, xv, yv, 0, 0);
    return laser;
  }
}

export { Ship, Laser, Point };
