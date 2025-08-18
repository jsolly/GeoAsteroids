import { Sound } from '../../audio/Sound.ts';
import {
  EMP_PULSE_DURATION,
  FPS,
  FRICTION,
  getCVS,
  LASER_DIST,
  LASER_EXPLODE_DUR,
  LASER_MAX,
  LASER_SPEED,
  SHIP_EXPLODE_DUR,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
  SHIP_MAX_HEALTH,
  SHIP_SIZE,
  SHIP_THRUST,
  START_LIVES,
} from '../../constants';
import { Vector } from '../../physics/Vector.ts';

import { drawThruster } from './shipRenderer.ts';

import {
  calculateHealthAfterDamage,
  calculateHealthAfterHeal,
  calculateHealthRegenDelayFrames,
  calculateHealthRegenPerFrame,
  calculateLaserStartPosition,
  canTakeCollisionDamage,
  isDebugMode,
  shouldStartHealthRegeneration,
} from './shipUtils.ts';

interface LaserData {
  position: Vector;
  velocity: Vector;
  distTraveled: number;
  explodeTime: number;
}

class Laser implements LaserData {
  static fxLaser: Sound = new Sound('sounds/laser.m4a', 5);
  static fxHit: Sound = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Vector,
    public velocity: Vector,
    public distTraveled: number,
    public explodeTime: number
  ) {}
}

class Ship {
  position = new Vector(0, 0);
  velocity = new Vector(0, 0);
  r: number = SHIP_SIZE / 2;
  a: number = (90 / 180) * Math.PI;
  blinkCount: number = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  spawnProtectionTimer: number = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
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
  lastCollisionTime: number = 0;
  lives: number = START_LIVES;
  blinkOn: boolean = false;
  lastShotTime: number = 0;
  shotCooldown: number = 2000;
  thrusterActive: boolean = false;
  lastPosition?: Vector; // Track previous position for movement analysis
  lastRotation?: number; // Track previous rotation for movement analysis

  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);

  constructor(
    lives: number = START_LIVES,
    blinkOn: boolean = false,
    options?: {
      position?: Vector;
      velocity?: Vector;
      rotation?: number;
      health?: number;
      maxHealth?: number;
      exploding?: boolean;
      explodeTime?: number;
      canShoot?: boolean;
      shotCooldown?: number;
      blinkCount?: number;
      spawnProtectionTimer?: number;
      lastDamageTime?: number;
      healthRegenTimer?: number;
    }
  ) {
    this.lives = lives;
    this.blinkOn = blinkOn;

    // Apply optional overrides
    if (options?.position) {
      this.position = options.position;
    }
    if (options?.velocity) {
      this.velocity = options.velocity;
    }
    if (options?.rotation !== undefined) {
      this.a = options.rotation;
    }
    if (options?.health !== undefined) {
      this.health = options.health;
    }
    if (options?.maxHealth !== undefined) {
      this.maxHealth = options.maxHealth;
    }
    if (options?.exploding !== undefined) {
      this.exploding = options.exploding;
    }
    if (options?.explodeTime !== undefined) {
      this.explodeTime = options.explodeTime;
    }
    if (options?.canShoot !== undefined) {
      this.canShoot = options.canShoot;
    }
    if (options?.shotCooldown !== undefined) {
      this.shotCooldown = options.shotCooldown;
    }
    if (options?.blinkCount !== undefined) {
      this.blinkCount = options.blinkCount;
    }
    if (options?.spawnProtectionTimer !== undefined) {
      this.spawnProtectionTimer = options.spawnProtectionTimer;
    }
    if (options?.lastDamageTime !== undefined) {
      this.lastDamageTime = options.lastDamageTime;
    }
    if (options?.healthRegenTimer !== undefined) {
      this.healthRegenTimer = options.healthRegenTimer;
    }
  }

  setBlinkOn(): void {
    this.blinkOn = this.blinkCount % 2 === 0;
  }

  explode(): void {
    this.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
    this.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
    Ship.fxExplode.play();
  }

  setExploding(): void {
    this.exploding = this.explodeTime > 0;
  }

  applyVelocity(): void {
    if (this.thrusting && !this.dead) {
      const thrust = Vector.fromAngle(this.a).multiply(SHIP_THRUST / FPS);
      this.velocity = this.velocity.add(thrust);
      drawThruster(this);
    } else {
      this.velocity = this.velocity.multiply(1 - FRICTION / FPS);
    }
  }

  move(): void {
    this.a += this.rot;
    this.applyVelocity();

    const newPosition = this.position.add(this.velocity);
    this.position = newPosition;

    this.updateHealth();
  }

  canShootAgain(): boolean {
    if (this.canShoot && this.lasers.length < LASER_MAX) {
      return true;
    }
    this.canShoot = false;
    return false;
  }

  shoot(): void {
    if (this.canShootAgain()) {
      this.fireLaser();
    }
  }

  fireLaser(): void {
    const laser = this.generateLaser();
    this.lasers.push(laser);
    Laser.fxLaser.play();
  }

  moveLasers(): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];

      if (laser.explodeTime > 0) {
        laser.explodeTime--;
        if (laser.explodeTime === 0) {
          this.lasers.splice(i, 1);
          continue;
        }
      } else {
        laser.position = laser.position.add(laser.velocity);
        laser.distTraveled += laser.velocity.magnitude();
      }

      const cvs = getCVS();
      if (cvs && laser.distTraveled >= LASER_DIST + cvs.width) {
        this.lasers.splice(i, 1);
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

    const laserStartPosition = calculateLaserStartPosition(this.position, this.a, this.r);
    return new Laser(laserStartPosition, laserVelocity, 0, 0);
  }

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
    if (data.r !== undefined) {
      this.r = data.r;
    }
    if (data.a !== undefined) {
      this.a = data.a;
    }
    if (data.lives !== undefined) {
      this.lives = data.lives;
    }
    if (data.dead !== undefined) {
      this.dead = data.dead;
    }
    if (data.exploding !== undefined) {
      this.exploding = data.exploding;
    }
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

  empPulse(): void {
    if (this.dead || this.exploding) {
      console.info('EMP', '🚫 EMP blocked - ship is dead or exploding', {
        shipDead: this.dead,
        shipExploding: this.exploding,
      });
      return;
    }

    const isDevelopment = isDebugMode();

    console.info('EMP', '⚡ EMP Pulse activated!', {
      position: { x: this.position.x, y: this.position.y },
      debugMode: isDevelopment,
      lives: this.lives,
    });

    this.empPulseActive = true;
    this.empPulseTime = Math.ceil(EMP_PULSE_DURATION * FPS);
    Ship.fxExplode.play();

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

    const isDebug = isDebugMode();
    this.health = calculateHealthAfterDamage(this.health, amount, this.maxHealth);
    this.lastDamageTime = FPS;
    this.healthRegenTimer = calculateHealthRegenDelayFrames();

    console.info('SHIP_DAMAGE', 'Ship took damage!', {
      damage: amount,
      remainingHealth: this.health,
      lives: this.lives,
      debugMode: isDebug,
      position: { x: this.position.x, y: this.position.y },
    });

    if (this.health <= 0) {
      this.health = 0;

      if (isDebug) {
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;

        console.info('SHIP_DEBUG_MODE', 'Debug mode: Ship health reset to full', {
          health: this.health,
          lives: this.lives,
        });
      } else {
        this.lives--;
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;

        console.info('SHIP_LIFE_LOST', 'Ship lost a life!', {
          remainingLives: this.lives,
          healthReset: this.health,
          position: { x: this.position.x, y: this.position.y },
        });

        if (this.lives <= 0) {
          this.dead = true;
          this.explode();
        } else {
          window.dispatchEvent(
            new CustomEvent('shipLifeLost', {
              detail: {
                remainingLives: this.lives,
                position: { x: this.position.x, y: this.position.y },
              },
            })
          );
        }
      }
    }
  }

  canTakeCollisionDamage(cooldownMs: number = 500): boolean {
    return canTakeCollisionDamage(this.lastCollisionTime, cooldownMs);
  }

  heal(amount: number): void {
    if (this.dead || this.exploding) {
      return;
    }

    const oldHealth = this.health;
    this.health = calculateHealthAfterHeal(this.health, amount, this.maxHealth);

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

    if (this.lastDamageTime > 0) {
      this.lastDamageTime--;
    }

    if (shouldStartHealthRegeneration(this.lastDamageTime, this.health, this.maxHealth)) {
      if (this.healthRegenTimer <= 0) {
        this.heal(calculateHealthRegenPerFrame());
      } else {
        this.healthRegenTimer--;
      }
    }
  }

  updateExplosion(): void {
    if (this.exploding && this.explodeTime > 0) {
      this.explodeTime--;
      if (this.explodeTime <= 0) {
        this.exploding = false;
        this.setExploding();
      }
    }
  }

  updateInvincibility(): void {
    if (this.blinkCount > 0) {
      this.spawnProtectionTimer--;
      if (this.spawnProtectionTimer <= 0) {
        this.blinkCount--;
        this.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        this.setBlinkOn();
      }
    }
  }
}

export { Ship, Laser };
