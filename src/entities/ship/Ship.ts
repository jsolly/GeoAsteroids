import { Sound } from '../../audio/Sound';
import {
  EMP_PULSE_DURATION,
  FPS,
  FRICTION,
  getCVS,
  LASER_DIST,
  LASER_EXPLODE_DUR,
  LASER_MAX,
  LASER_SPEED,
  SHIP_EXPLODE_DUR_FRAMES,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
  SHIP_MAX_HEALTH,
  SHIP_SIZE,
  SHIP_THRUST,
} from '../../constants';
import { Vector } from '../../physics/Vector';

import { drawThruster } from './shipRenderer';

import {
  calculateHealthAfterDamage,
  calculateHealthAfterHeal,
  calculateHealthRegenDelayFrames,
  calculateHealthRegenPerFrame,
  calculateLaserStartPosition,
  canTakeCollisionDamage,
  isDebugMode,
  shouldStartHealthRegeneration,
} from './shipUtils';

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
  blinkOn: boolean = true; // Start blinking when invincible
  lastShotTime: number = 0;
  shotCooldown: number = 2000;
  thrusterActive: boolean = false;
  lastPosition?: Vector; // Track previous position for movement analysis
  lastRotation?: number; // Track previous rotation for movement analysis

  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);

  constructor(options?: {
    position?: Vector;
    shotCooldown?: number;
  }) {
    // Apply optional overrides for bot-specific configuration
    if (options?.position) {
      this.position = options.position;
    }
    if (options?.shotCooldown !== undefined) {
      this.shotCooldown = options.shotCooldown;
    }
  }

  setBlinkOn(): void {
    this.blinkOn = this.blinkCount % 2 === 0;
  }

  explode(): void {
    this.explodeTime = SHIP_EXPLODE_DUR_FRAMES;
    this.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
    Ship.fxExplode.play();
  }

  setExploding(): void {
    this.exploding = this.explodeTime > 0;
  }

  applyVelocity(): void {
    if (this.thrusting) {
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
    if (data.exploding !== undefined) {
      this.exploding = data.exploding;
    }
  }

  getNetworkData(): {
    position: Vector;
    velocity: Vector;
    r: number;
    a: number;
    exploding: boolean;
  } {
    return {
      position: this.position,
      velocity: this.velocity,
      r: this.r,
      a: this.a,
      exploding: this.exploding,
    };
  }

  empPulse(): void {
    if (this.exploding) {
      return;
    }

    const isDevelopment = isDebugMode();

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
    if (this.exploding) {
      return;
    }

    const isDebug = isDebugMode();
    this.health = calculateHealthAfterDamage(this.health, amount, this.maxHealth);
    this.lastDamageTime = FPS;
    this.healthRegenTimer = calculateHealthRegenDelayFrames();

    if (this.health <= 0) {
      this.health = 0;

      if (isDebug) {
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;
      } else {
        // Ship health reached 0, notify that a life should be lost
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.healthRegenTimer = 0;

        // Ship health reached 0, it should explode
        this.explode();

        // Dispatch event to notify that ship has exploded
        window.dispatchEvent(
          new CustomEvent('shipExploded', {
            detail: {
              position: { x: this.position.x, y: this.position.y },
            },
          })
        );
      }
    }
  }

  canTakeCollisionDamage(cooldownMs: number = 500): boolean {
    return canTakeCollisionDamage(this.lastCollisionTime, cooldownMs);
  }

  heal(amount: number): void {
    if (this.exploding) {
      return;
    }

    this.health = calculateHealthAfterHeal(this.health, amount, this.maxHealth);
  }

  updateHealth(): void {
    if (this.exploding) {
      return;
    }

    if (this.lastDamageTime > 0) {
      this.lastDamageTime--;
    }

    if (shouldStartHealthRegeneration(this.lastDamageTime, this.health, this.maxHealth)) {
      if (this.healthRegenTimer <= 0) {
        const healthBefore = this.health;
        this.heal(calculateHealthRegenPerFrame());
        const healthAfter = this.health;

        if (healthBefore !== healthAfter) {
          console.debug('SHIP_HEALTH_DEBUG', 'Health regenerated', {
            healthBefore,
            healthAfter,
            maxHealth: this.maxHealth,
            regenAmount: calculateHealthRegenPerFrame(),
            lastDamageTime: this.lastDamageTime,
            healthRegenTimer: this.healthRegenTimer,
          });
        }
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
