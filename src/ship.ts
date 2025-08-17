import {
  FPS,
  LASER_EXPLODE_DUR,
  LASER_DIST,
  getCVS,
  SHIP_EXPLODE_DUR,
  SHIP_INV_DUR,
  SHIP_SIZE,
  SHIP_THRUST,
  START_LIVES,
  SHIP_INV_BLINK_DUR,
  LASER_SPEED,
  LASER_MAX,
  FRICTION,
  EMP_PULSE_DURATION,
  SHIP_MAX_HEALTH,
  SHIP_HEALTH_REGEN_RATE,
  SHIP_HEALTH_REGEN_DELAY,
} from './constants.js';
import { Sound } from './soundsMusic.js';
import { drawThruster } from './shipCanv.js';
import { Vector } from './vector.js';

interface ILaser {
  position: Vector;
  velocity: Vector;
  distTraveled: number;
  explodeTime: number;
}

interface IShip {
  lives: number;
  health: number;
  maxHealth: number;
  blinkOn: boolean;
  position: Vector;
  velocity: Vector;
  r: number;
  a: number;
  blinkCount: number;
  blinkTime: number;
  canShoot: boolean;
  dead: boolean;
  exploding: boolean;
  lasers: Laser[];
  explodeTime: number;
  rot: number;
  thrusting: boolean;
  empPulseActive: boolean;
  empPulseTime: number;
  lastDamageTime: number;
  healthRegenTimer: number;
  takeDamage(amount: number): void;
  heal(amount: number): void;
  updateHealth(): void;
  die(): void;
  setBlinkOn(): void;
  explode(): void;
  setExploding(): void;
  applyVelocity(): void;
  move(): void;
  canShootAgain(): boolean;
  shoot(): void;
  fireLaser(): void;
  moveLasers(): void;
  updateLaserExplodeTime(i: number): void;
  generateLaser(): Laser;
  empPulse(): void;
  updateEmpPulse(): void;
}

class Laser implements ILaser {
  static fxLaser: Sound = new Sound('sounds/laser.m4a', 5);
  static fxHit: Sound = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Vector,
    public velocity: Vector,
    public distTraveled: number,
    public explodeTime: number,
  ) {}
}

class Ship implements IShip {
  position = new Vector(0, 0); // Start at world origin
  velocity = new Vector(0, 0);
  r: number = SHIP_SIZE / 2;
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
  empPulseActive = false;
  empPulseTime = 0;
  health: number = SHIP_MAX_HEALTH;
  maxHealth: number = SHIP_MAX_HEALTH;
  lastDamageTime: number = 0;
  healthRegenTimer: number = 0;
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
  ) {
    // In debug mode, use normal lives but collisions are disabled
    // Note: We can't import logger here due to circular dependency, so we'll keep console.log for now
    console.log(
      '🚀 Ship created with',
      this.lives,
      'lives and',
      this.health,
      'health',
    );
  }

  die(): void {
    console.info('SHIP_DEATH', 'Ship died!', {
      lives: this.lives,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      exploding: this.exploding,
      blinkCount: this.blinkCount,
      stack: new Error().stack,
    });

    // Only mark as dead if no lives remaining
    if (this.lives <= 0) {
      this.dead = true;
      console.info(
        'SHIP_DEATH_FINAL',
        'Ship marked as dead - no lives remaining',
      );
    } else {
      console.info(
        'SHIP_DEATH_PREVENTED',
        'Ship death prevented - still has lives',
        {
          remainingLives: this.lives,
        },
      );
    }
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
    // console.log('💥 Ship exploding!', {
    //   lives: this.lives,
    //   position: { x: this.position.x, y: this.position.y },
    //   explodeTime: this.explodeTime,
    //   blinkCount: this.blinkCount,
    // });
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
      const thrust = Vector.fromAngle(this.a).multiply(SHIP_THRUST / FPS);
      this.velocity = this.velocity.add(thrust);

      drawThruster(this);
    } else {
      // apply friction when ship not thrusting
      this.velocity = this.velocity.multiply(1 - FRICTION / FPS);
    }
  }

  move(): void {
    // rotate ship
    this.a += this.rot;

    // apply velocity
    this.applyVelocity();

    // move the ship
    const newPosition = this.position.add(this.velocity);

    // Debug logging for movement (disabled to prevent spam)
    // if (this.velocity.magnitude() > 0.1) {
    //   console.log('🚀 Ship moving:', {
    //     oldPos: { x: this.position.x, y: this.position.y },
    //     newPos: { x: newPosition.x, y: newPosition.y },
    //     velocity: { x: this.velocity.x, y: this.velocity.y },
    //     thrusting: this.thrusting,
    //     dead: this.dead,
    //     exploding: this.exploding,
    //   });
    // }

    this.position = newPosition;

    // Update health regeneration timer
    if (this.lastDamageTime > 0) {
      this.lastDamageTime--;
    }

    // Start health regeneration after delay
    if (this.lastDamageTime <= 0 && this.health < this.maxHealth) {
      if (this.healthRegenTimer <= 0) {
        this.heal(SHIP_HEALTH_REGEN_RATE / FPS);
      } else {
        this.healthRegenTimer--;
      }
    }
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

      // handle the explosion
      if (laser.explodeTime > 0) {
        laser.explodeTime--;

        if (laser.explodeTime == 0) {
          this.lasers.splice(i, 1);
          continue;
        }
      } else {
        laser.position = laser.position.add(laser.velocity);

        laser.distTraveled += laser.velocity.magnitude();
      }

      // check laser distance after moving
      const cvs = getCVS();
      if (cvs && laser.distTraveled >= LASER_DIST + cvs.width) {
        this.lasers.splice(i, 1);
        continue;
      }
    }
  }

  updateLaserExplodeTime(i: number): void {
    this.lasers[i].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
  }

  generateLaser(): Laser {
    const laserVelocity = Vector.fromAngle(this.a)
      .multiply(LASER_SPEED / FPS)
      .add(this.velocity);

    const noseOffset = Vector.fromAngle(this.a).multiply((4 / 3) * this.r);
    const laserStartPosition = this.position.add(noseOffset);

    const laser = new Laser(laserStartPosition, laserVelocity, 0, 0);
    return laser;
  }

  // Multiplayer synchronization methods
  updateFromNetwork(data: {
    position?: Vector;
    velocity?: Vector;
    r?: number;
    a?: number;
    lives?: number;
    dead?: boolean;
    exploding?: boolean;
  }): void {
    if (data.position) {
      this.position = new Vector(data.position.x, data.position.y);
    }
    if (data.velocity) {
      this.velocity = new Vector(data.velocity.x, data.velocity.y);
    }
    if (data.r !== undefined) this.r = data.r;
    if (data.a !== undefined) this.a = data.a;
    if (data.lives !== undefined) this.lives = data.lives;
    if (data.dead !== undefined) this.dead = data.dead;
    if (data.exploding !== undefined) this.exploding = data.exploding;
  }

  getNetworkData(): {
    position: Vector;
    velocity: Vector;
    r: number;
    a: number;
    lives: number;
    dead: boolean;
    exploding: boolean;
  } {
    return {
      position: this.position,
      velocity: this.velocity,
      r: this.r,
      a: this.a,
      lives: this.lives,
      dead: this.dead,
      exploding: this.exploding,
    };
  }

  /**
   * EMP Pulse - destroys all asteroids and bots within radius
   * In debug mode, can be used unlimited times
   */
  empPulse(): void {
    // Check if we can use EMP (not dead, not exploding)
    if (this.dead || this.exploding) {
      console.info('EMP', '🚫 EMP blocked - ship is dead or exploding', {
        shipDead: this.dead,
        shipExploding: this.exploding,
      });
      return;
    }

    // In debug mode, unlimited EMP usage
    const isDevelopment =
      (import.meta.env?.DEV === true ||
        import.meta.env?.MODE === 'development') &&
      import.meta.env?.VITE_INVINCIBLE === 'true';

    console.info('EMP', '⚡ EMP Pulse activated!', {
      position: { x: this.position.x, y: this.position.y },
      debugMode: isDevelopment,
      lives: this.lives,
    });

    // Activate EMP pulse visual effect
    this.empPulseActive = true;
    this.empPulseTime = Math.ceil(EMP_PULSE_DURATION * FPS);

    // Play EMP sound effect
    Ship.fxExplode.play();

    // Dispatch custom event for game controller to handle
    const empEvent = new CustomEvent('empPulse', {
      detail: {
        shipPosition: this.position,
        shipRadius: this.r,
        debugMode: isDevelopment,
      },
    });

    window.dispatchEvent(empEvent);
  }

  updateEmpPulse(): void {
    if (this.empPulseActive) {
      this.empPulseTime--;
      if (this.empPulseTime <= 0) {
        this.empPulseActive = false;
        this.empPulseTime = 0;
      }
    }
  }

  takeDamage(amount: number): void {
    if (this.dead || this.exploding) {
      return;
    }

    // Check if we're in debug mode
    const isDebugMode =
      (import.meta.env?.DEV === true ||
        import.meta.env?.MODE === 'development') &&
      import.meta.env?.VITE_INVINCIBLE === 'true';

    this.health -= amount;
    this.lastDamageTime = FPS;
    this.healthRegenTimer = Math.ceil(SHIP_HEALTH_REGEN_DELAY * FPS);

    console.info('SHIP_DAMAGE', 'Ship took damage!', {
      damage: amount,
      remainingHealth: this.health,
      lives: this.lives,
      debugMode: isDebugMode,
      position: { x: this.position.x, y: this.position.y },
    });

    if (this.health <= 0) {
      this.health = 0;

      if (isDebugMode) {
        // In debug mode, just reset health to full without losing lives
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;

        console.info(
          'SHIP_DEBUG_MODE',
          'Debug mode: Ship health reset to full',
          {
            health: this.health,
            lives: this.lives,
          },
        );
      } else {
        // In normal mode, lose a life and reset health
        this.lives--;
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;

        console.info('SHIP_LIFE_LOST', 'Ship lost a life!', {
          remainingLives: this.lives,
          healthReset: this.health,
          position: { x: this.position.x, y: this.position.y },
        });

        // Only die and explode if no lives remaining
        if (this.lives <= 0) {
          this.die();
          // Ship is now dead, so explode it
          this.explode();
        } else {
          // Ship still has lives, dispatch event for respawn handling
          window.dispatchEvent(
            new CustomEvent('shipLifeLost', {
              detail: {
                remainingLives: this.lives,
                position: { x: this.position.x, y: this.position.y },
              },
            }),
          );
        }
      }
    }
  }

  heal(amount: number): void {
    if (this.dead || this.exploding) {
      return;
    }

    const oldHealth = this.health;
    this.health = Math.min(this.health + amount, this.maxHealth);

    if (this.health > oldHealth) {
      console.info('SHIP_HEAL', 'Ship healed!', {
        healAmount: this.health - oldHealth,
        newHealth: this.health,
        maxHealth: this.maxHealth,
      });
    }
  }

  updateHealth(): void {
    if (this.dead || this.exploding) {
      return;
    }

    // Update health regeneration timer
    if (this.lastDamageTime > 0) {
      this.lastDamageTime--;
    }

    // Start health regeneration after delay
    if (this.lastDamageTime <= 0 && this.health < this.maxHealth) {
      if (this.healthRegenTimer <= 0) {
        this.heal(SHIP_HEALTH_REGEN_RATE / FPS);
      } else {
        this.healthRegenTimer--;
      }
    }
  }
}

export { Ship, Laser };
