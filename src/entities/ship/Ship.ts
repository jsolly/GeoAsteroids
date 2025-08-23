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
import {
  addPositionAndVelocity,
  addVectors,
  getVelocityMagnitude,
  multiplyVelocity,
} from '../../utils/mathUtils';
import type { Position, Velocity } from '../player/types';

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
  position: Position;
  velocity: Velocity;
  distTraveled: number;
  explodeTime: number;
}

class Laser implements LaserData {
  static fxLaser: Sound = new Sound('sounds/laser.m4a', 5);
  static fxHit: Sound = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Position,
    public velocity: Velocity,
    public distTraveled: number,
    public explodeTime: number
  ) {}
}

class Ship {
  position: Position = { x: 0, y: 0 };
  velocity: Velocity = { x: 0, y: 0 };
  r: number = SHIP_SIZE / 2;
  angle: number = (90 / 180) * Math.PI;
  blinkCount: number = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  spawnProtectionTimer: number = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  canShoot = true;
  exploding = false;
  lasers: Laser[] = [];
  explodeTime = 0;
  angularVelocity = 0;
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
  lastPosition?: Position; // Track previous position for movement analysis
  lastRotation?: number; // Track previous rotation for movement analysis

  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);

  constructor(options?: {
    position?: Position;
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
      const thrust: Velocity = {
        x: (Math.cos(this.angle) * SHIP_THRUST) / FPS,
        y: (-Math.sin(this.angle) * SHIP_THRUST) / FPS,
      };
      this.velocity = addVectors(this.velocity, thrust);
      drawThruster(this);
    } else {
      this.velocity = multiplyVelocity(this.velocity, 1 - FRICTION / FPS);
    }
  }

  move(): void {
    this.angle += this.angularVelocity;
    this.applyVelocity();

    const newPosition = addPositionAndVelocity(this.position, this.velocity);
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
        laser.position = addPositionAndVelocity(laser.position, laser.velocity);
        laser.distTraveled += getVelocityMagnitude(laser.velocity);
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
    const baseVelocity: Velocity = {
      x: (Math.cos(this.angle) * LASER_SPEED) / FPS,
      y: (-Math.sin(this.angle) * LASER_SPEED) / FPS,
    };
    const laserVelocity = addVectors(baseVelocity, this.velocity);

    const laserStartPosition = calculateLaserStartPosition(this.position, this.angle, this.r);
    return new Laser(laserStartPosition, laserVelocity, 0, 0);
  }

  updateFromNetwork(data: {
    position?: Position;
    velocity?: Velocity;
    r?: number;
    angle?: number;
    lives?: number;
    exploding?: boolean;
  }): void {
    // Use Object.assign for efficient bulk assignment
    const updates: Partial<Ship> = {};

    if (data.position) {
      updates.position = data.position;
    }
    if (data.velocity) {
      updates.velocity = data.velocity;
    }
    if (data.r !== undefined) {
      updates.r = data.r;
    }
    if (data.angle !== undefined) {
      updates.angle = data.angle;
    }
    if (data.exploding !== undefined) {
      updates.exploding = data.exploding;
    }

    Object.assign(this, updates);
  }

  getNetworkData(): {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    r: number;
    angle: number;
    exploding: boolean;
  } {
    return {
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      r: this.r,
      angle: this.angle,
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
