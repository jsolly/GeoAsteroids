import { v4 as uuidv4 } from 'uuid';
import type { Position, Velocity } from '../../../shared-types';
import { Sound } from '../../audio/Sound';
import { LASER_MAX } from '../../constants/entities/laser';
import {
  SHIP_BOT_FRICTION,
  SHIP_EXPLODE_DUR_FRAMES,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
  SHIP_MAX_HEALTH,
  SHIP_MAX_VELOCITY,
  SHIP_SIZE,
  SHIP_THRUST,
} from '../../constants/entities/ship';
import { EMP_PULSE_DURATION, FPS, FRICTION } from '../../constants/game';
import { addPositionAndVelocity, addVectors, multiplyVelocity } from '../../utils/mathUtils';
import type { Laser } from '../laser/Laser';
import { createLaser } from '../laser/laserUtils';

import { drawThruster } from './shipRenderer';

import {
  calculateHealthAfterDamage,
  calculateHealthAfterHeal,
  calculateHealthRegenDelayFrames,
  calculateHealthRegenPerFrame,
  canTakeCollisionDamage,
  shouldStartHealthRegeneration,
} from './shipUtils';

class Ship {
  id: string = uuidv4(); // Unique identifier for event handling
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
  color: string = '#ffffff'; // Ship color for rendering
  isBot: boolean = false; // Flag to identify if this ship belongs to a bot

  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);

  constructor(options?: {
    position?: Position;
    shotCooldown?: number;
    color?: string;
    isBot?: boolean;
  }) {
    // Apply optional overrides for bot-specific configuration
    if (options?.position) {
      this.position = options.position;
    }
    if (options?.shotCooldown !== undefined) {
      this.shotCooldown = options.shotCooldown;
    }
    if (options?.color) {
      this.color = options.color;
    }
    if (options?.isBot !== undefined) {
      this.isBot = options.isBot;
    }
  }

  setBlinkOn(): void {
    this.blinkOn = this.blinkCount % 2 === 0;
  }

  explode(): void {
    this.explodeTime = SHIP_EXPLODE_DUR_FRAMES;
    this.exploding = true; // Set exploding flag when explosion starts
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

      // Cap velocity to prevent excessive speed
      const currentSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );
      if (currentSpeed > SHIP_MAX_VELOCITY) {
        const scale = SHIP_MAX_VELOCITY / currentSpeed;
        this.velocity.x *= scale;
        this.velocity.y *= scale;
      }

      drawThruster(this);
    } else {
      // Use bot-specific friction if this is a bot ship
      const frictionCoeff = this.isBot ? SHIP_BOT_FRICTION : FRICTION;
      this.velocity = multiplyVelocity(this.velocity, 1 - frictionCoeff / FPS);
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
    laser.playLaserSound();
  }

  moveLasers(): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];

      laser.move();

      // Remove lasers that have traveled their maximum distance OR finished exploding
      if (laser.shouldBeRemoved()) {
        this.lasers.splice(i, 1);
      }
    }
  }

  updateLaserExplodeTime(i: number): void {
    this.lasers[i].updateExplodeTime();
  }

  generateLaser(): Laser {
    return createLaser(this);
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

    this.empPulseActive = true;
    this.empPulseTime = Math.ceil(EMP_PULSE_DURATION * FPS);
    Ship.fxExplode.play();

    const empEvent = new CustomEvent('empPulse', {
      detail: {
        shipPosition: this.position,
        shipRadius: this.r,
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

    this.health = calculateHealthAfterDamage(this.health, amount, this.maxHealth);
    this.lastDamageTime = FPS;
    this.healthRegenTimer = calculateHealthRegenDelayFrames();

    if (this.health <= 0) {
      this.health = 0;

      // Ship health reached 0, it should explode
      this.explode();

      // Dispatch event to notify that ship has exploded
      window.dispatchEvent(
        new CustomEvent('shipExploded', {
          detail: {
            shipId: this.id,
            position: { x: this.position.x, y: this.position.y },
          },
        })
      );
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
          // Health regenerated
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

export { Ship };
