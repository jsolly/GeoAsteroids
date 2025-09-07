import { v4 as uuidv4 } from 'uuid';
import type { Position, Velocity } from '../../../shared-types';
import { playSound, Sound } from '../../audio/Sound';
import { EMP, GAME, LASER, SHIP } from '../../constants';
import { NetworkManager } from '../../network/networkManager';
import { logger } from '../../utils/Logger';
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
  r: number = SHIP.SIZE / 2;
  angle: number = (90 / 180) * Math.PI;
  blinkCount: number = Math.ceil(
    SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
  );
  spawnProtectionTimer: number = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
  canShoot = true;

  exploding = false;
  lasers: Laser[] = [];
  explodeTime = 0;
  angularVelocity = 0;
  thrusting = false;
  empPulseActive = false;
  empPulseTime = 0;
  health: number = SHIP.MAX_HEALTH;
  maxHealth: number = SHIP.MAX_HEALTH;
  lastDamageTime: number = 0;
  healthRegenTimer: number = 0;
  lastCollisionTime: number = 0;
  blinkOn: boolean; // Will be set in constructor based on blinkCount
  lastShotTime: number = 0;
  shotCooldown: number = 2000;
  thrusterActive: boolean = false;
  lastPosition?: Position; // Track previous position for movement analysis
  lastRotation?: number; // Track previous rotation for movement analysis
  color: string = '#ffffff'; // Ship color for rendering
  isBot: boolean = false; // Flag to identify if this ship belongs to a bot

  // Server-authoritative smoothing targets (for remote/bot ships)
  targetPosition?: Position;
  targetVelocity?: Velocity;
  targetAngle?: number;
  lastServerUpdateMs: number = 0;
  interpolationT: number = 0; // 0..1 blend factor toward target
  // Smoothing controls
  private static readonly INTERPOLATION_RATE = 0.15; // higher => faster catch-up
  private static readonly ANGLE_INTERPOLATION_RATE = 0.2;

  // Player collision damage-over-time tracking
  isCollidingWithPlayer: boolean = false;
  playerCollisionStartTime: number = 0;
  lastPlayerCollisionDamageTime: number = 0;
  collidingPlayerId?: string;

  static fxThrust = new Sound('sounds/thrust.m4a', 5);
  static fxExplode = new Sound('sounds/explode.m4a', 5);

  constructor(options?: {
    position?: Position;
    shotCooldown?: number;
    color?: string;
    isBot?: boolean;
  }) {
    // Initialize blinkOn based on initial blinkCount
    this.blinkOn = this.blinkCount % 2 === 0;

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

  explode(cause?: string, killerName?: string): void {
    this.explodeTime = SHIP.EXPLODE_DURATION_FRAMES;
    this.exploding = true; // Set exploding flag when explosion starts
    playSound(Ship.fxExplode);

    // Dispatch event to notify that ship has exploded with cause information
    window.dispatchEvent(
      new CustomEvent('shipExploded', {
        detail: {
          shipId: this.id,
          position: { x: this.position.x, y: this.position.y },
          cause,
          killerName,
        },
      })
    );
  }

  setExploding(): void {
    this.exploding = this.explodeTime > 0;
  }

  applyVelocity(): void {
    logger.debug('SHIP', 'applyVelocity called', {
      thrusting: this.thrusting,
      shipId: this.id,
      isBot: this.isBot,
    });

    if (this.thrusting) {
      const thrust: Velocity = {
        x: (Math.cos(this.angle) * SHIP.THRUST) / GAME.FPS,
        y: (-Math.sin(this.angle) * SHIP.THRUST) / GAME.FPS,
      };
      this.velocity = addVectors(this.velocity, thrust);

      // Cap velocity to prevent excessive speed
      const currentSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );
      if (currentSpeed > SHIP.MAX_VELOCITY) {
        const scale = SHIP.MAX_VELOCITY / currentSpeed;
        this.velocity.x *= scale;
        this.velocity.y *= scale;
      }

      drawThruster(this);
    } else {
      // Use bot-specific friction if this is a bot ship
      const frictionCoeff = this.isBot ? SHIP.BOT_FRICTION : GAME.FRICTION;
      this.velocity = multiplyVelocity(this.velocity, 1 - frictionCoeff / GAME.FPS);
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
    if (this.canShoot && this.lasers.length < LASER.MAX_COUNT) {
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

    // Send shooting event to network system
    this.sendShootEvent(laser.position, laser.velocity);
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

  private sendShootEvent(laserPosition: Position, laserVelocity: Velocity): void {
    // Only send shooting events for non-bot ships
    if (!this.isBot) {
      const networkManager = NetworkManager.getInstance();
      if (networkManager.isConnected) {
        // Send shoot event to server
        networkManager.updatePlayerState({
          position: this.position,
          velocity: this.velocity,
          r: this.r,
          angle: this.angle,
          lives: 0, // This will be updated by server
          score: 0, // This will be updated by server
          exploding: this.exploding,
          lasers: [
            {
              position: laserPosition,
              velocity: laserVelocity,
              distTraveled: 0,
              explodeTime: 0,
              hasExploded: false,
            },
          ],
        });
      }
    }
  }

  updateFromNetwork(data: {
    position?: Position;
    velocity?: Velocity;
    r?: number;
    angle?: number;
    lives?: number;
    exploding?: boolean;
  }): void {
    // Local player uses immediate state; bots/remote ships use smoothing targets
    if (this.isBot) {
      // Bots: set targets and smooth toward them
      if (data.position) {
        this.targetPosition = { x: data.position.x, y: data.position.y };
      }
      if (data.velocity) {
        this.targetVelocity = { x: data.velocity.x, y: data.velocity.y };
      }
      if (data.angle !== undefined) {
        this.targetAngle = data.angle;
      }
      if (data.exploding !== undefined) {
        this.exploding = data.exploding;
      }
      if (data.r !== undefined) {
        this.r = data.r;
      }
      this.lastServerUpdateMs = performance.now ? performance.now() : Date.now();
      return;
    }

    // Non-bot ships: assign immediately (existing behavior)
    if (data.position) {
      this.position = data.position;
    }
    if (data.velocity) {
      this.velocity = data.velocity;
    }
    if (data.r !== undefined) {
      this.r = data.r;
    }
    if (data.angle !== undefined) {
      this.angle = data.angle;
    }
    if (data.exploding !== undefined) {
      this.exploding = data.exploding;
    }
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
    this.empPulseTime = Math.ceil(EMP.DURATION * GAME.FPS);
    playSound(Ship.fxExplode);

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

  takeDamage(amount: number, cause?: string, killerName?: string): void {
    if (this.exploding) {
      return;
    }

    // Instrumentation for tests: trace damage handling when under test
    const prevHealth = this.health;
    this.health = calculateHealthAfterDamage(this.health, amount, this.maxHealth);
    if (process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.debug('SHIP', 'takeDamage', {
        amount,
        prevHealth,
        newHealth: this.health,
        maxHealth: this.maxHealth,
      });
    }
    this.lastDamageTime = GAME.FPS;
    this.healthRegenTimer = calculateHealthRegenDelayFrames();

    if (this.health <= 0) {
      this.health = 0;
      this.explode(cause, killerName);
    }
  }

  canTakeCollisionDamage(cooldownMs: number = 500): boolean {
    return canTakeCollisionDamage(this.lastCollisionTime, cooldownMs);
  }

  startPlayerCollision(collidingPlayerId?: string): void {
    if (!this.isCollidingWithPlayer) {
      this.isCollidingWithPlayer = true;
      this.playerCollisionStartTime = Date.now();
      this.lastPlayerCollisionDamageTime = Date.now();
    }
    if (collidingPlayerId) {
      this.collidingPlayerId = collidingPlayerId;
    }
  }

  stopPlayerCollision(): void {
    this.isCollidingWithPlayer = false;
    this.playerCollisionStartTime = 0;
    this.lastPlayerCollisionDamageTime = 0;
    this.collidingPlayerId = undefined;
  }

  updatePlayerCollisionDamage(): void {
    if (!this.isCollidingWithPlayer || this.exploding) {
      return;
    }

    const now = Date.now();
    const timeSinceLastDamage = now - this.lastPlayerCollisionDamageTime;
    const damageInterval = 1000 / SHIP.PLAYER_COLLISION_DAMAGE_PER_SECOND; // e.g., 20 DPS => 50ms per damage

    if (timeSinceLastDamage >= damageInterval) {
      // Apply local damage only when not connected to server; otherwise server-authoritative
      const networkManager = NetworkManager.getInstance();
      if (networkManager.isConnected && this.collidingPlayerId) {
        const myPlayerId = networkManager.getLocalPlayerId();
        if (myPlayerId) {
          logger.debug('COLLISION', 'Sending collision damage', {
            from: myPlayerId,
            to: this.collidingPlayerId,
            toIsBot: this.collidingPlayerId.startsWith('server-bot-'),
            damage: 1,
          });
          // Send collision event to server
          networkManager.updatePlayerState({
            position: this.position,
            velocity: this.velocity,
            r: this.r,
            angle: this.angle,
            lives: 0, // This will be updated by server
            score: 0, // This will be updated by server
            exploding: this.exploding,
          });
        }
      } else {
        logger.debug('COLLISION', 'Applying local collision damage', { damage: 1 });
        this.takeDamage(1, 'player');
      }
      this.lastPlayerCollisionDamageTime = now;
    }
  }

  heal(amount: number): void {
    if (this.exploding) {
      return;
    }

    this.health = calculateHealthAfterHeal(this.health, amount, this.maxHealth);
  }

  updateHealth(): void {
    // Health regeneration is now handled server-side for network consistency
    // Local regeneration is disabled to prevent conflicts with server updates
    if (process.env.NODE_ENV === 'test') {
      // Keep local regeneration for tests
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
            if (this.isBot) {
              logger.debug('SHIP', 'Bot health regenerated', {
                healthBefore,
                healthAfter,
                lastDamageTime: this.lastDamageTime,
                healthRegenTimer: this.healthRegenTimer,
              });
            }
          }
        } else {
          this.healthRegenTimer--;
        }
      }
    }

    // Update player collision damage-over-time
    this.updatePlayerCollisionDamage();
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
        this.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
        this.setBlinkOn();
      }
    }
  }

  // Main update method called each frame
  update(): void {
    if (this.exploding) {
      this.updateExplosion();
      return;
    }

    // Update invincibility and blinking
    this.updateInvincibility();

    // Update health
    this.updateHealth();

    // Apply movement
    this.updateMovement();

    // Update EMP pulse
    this.updateEmpPulse();

    // Update lasers
    this.moveLasers();
  }

  // Update ship movement (position, velocity, rotation)
  private updateMovement(): void {
    // For bots, blend client position toward server target (client-side smoothing)
    if (this.isBot) {
      this.stepInterpolation();
      return;
    }

    // Apply angular velocity to rotation
    this.angle += this.angularVelocity;

    // Apply thrust if thrusting
    if (this.thrusting) {
      const thrust: Velocity = {
        x: (Math.cos(this.angle) * SHIP.THRUST) / GAME.FPS,
        y: (-Math.sin(this.angle) * SHIP.THRUST) / GAME.FPS,
      };
      this.velocity = addVectors(this.velocity, thrust);

      // Cap velocity to prevent excessive speed
      const currentSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );
      if (currentSpeed > SHIP.MAX_VELOCITY) {
        const scale = SHIP.MAX_VELOCITY / currentSpeed;
        this.velocity.x *= scale;
        this.velocity.y *= scale;
      }
    } else {
      // Apply friction
      this.velocity = multiplyVelocity(this.velocity, 1 - GAME.FRICTION / GAME.FPS);
    }

    // Update position based on velocity
    this.position = addPositionAndVelocity(this.position, this.velocity);
  }

  // Smoothly approach target state for non-local ships
  private stepInterpolation(): void {
    if (this.targetPosition) {
      const rate = Ship.INTERPOLATION_RATE;
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      this.position = { x: this.position.x + dx * rate, y: this.position.y + dy * rate };
    }

    if (this.targetVelocity) {
      const rate = Ship.INTERPOLATION_RATE;
      const dvx = this.targetVelocity.x - this.velocity.x;
      const dvy = this.targetVelocity.y - this.velocity.y;
      this.velocity = { x: this.velocity.x + dvx * rate, y: this.velocity.y + dvy * rate };
    }

    if (this.targetAngle !== undefined) {
      const rate = Ship.ANGLE_INTERPOLATION_RATE;
      // Shortest angle interpolation
      let delta = this.targetAngle - this.angle;
      while (delta > Math.PI) {
        delta -= 2 * Math.PI;
      }
      while (delta < -Math.PI) {
        delta += 2 * Math.PI;
      }
      this.angle += delta * rate;
    }
  }
}

export { Ship };
