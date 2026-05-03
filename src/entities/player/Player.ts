import type { Position } from '../../../shared-types';
import { GAME, SHIP } from '../../constants';
import type { PlayerInput } from '../../input/PlayerInput';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import { logger } from '../../utils/Logger';
import { Ship } from '../ship/Ship';

export class Player {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  ship: Ship;
  score: number = 0;
  lastUpdate: number = Date.now();
  lives: number = GAME.START_LIVES;
  color: string; // Player's unique color for lasers and other visual elements
  deathCause?: string; // What killed the player (asteroid, boundary, player name, etc.)
  input: PlayerInput; // Unified input system for all player types

  // Interpolation state for smooth movement (disabled for now to fix popping issue)
  // private targetPosition?: Position;
  // private targetVelocity?: Position;
  // private targetAngle?: number;
  // private interpolationStartTime?: number;
  // private interpolationDuration: number = 100; // 100ms interpolation

  constructor(params: {
    id: string;
    name: string;
    type: 'local' | 'remote' | 'bot';
    input: PlayerInput;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.type = params.type;
    this.input = params.input;

    // Assign a random color for this player
    this.color = generateRandomPlayerColor();

    // Create ship with player's color and friction coefficient
    this.ship = new Ship({
      color: this.color,
      isBot: this.type === 'bot',
      isLocalPlayer: this.type === 'local',
      frictionCoefficient: this.getFrictionCoefficient(),
    });
  }

  // Update player state from server data
  updateFromServer(data: {
    position?: Position;
    velocity?: Position;
    angle?: number;
    lives?: number;
    score?: number;
    exploding?: boolean;
    thrusting?: boolean;
    color?: string;
    deathCause?: string;
    health?: number;
    maxHealth?: number;
    respawnTimer?: number;
  }): void {
    // Update all players directly for now (disable interpolation to fix popping issue)
    if (data.position) {
      this.ship.position = data.position;
    }
    if (data.velocity) {
      this.ship.velocity = data.velocity;
    }
    if (data.angle !== undefined) {
      this.ship.angle = data.angle;
    }
    if (data.lives !== undefined) {
      this.lives = data.lives;
    }
    if (data.score !== undefined) {
      this.score = data.score;
    }
    if (data.exploding !== undefined) {
      this.ship.exploding = data.exploding;
    }
    if (data.thrusting !== undefined) {
      this.ship.thrusting = data.thrusting;
    }
    if (data.color !== undefined) {
      this.color = data.color;
      this.ship.color = data.color;
    }
    if (data.deathCause) {
      this.deathCause = data.deathCause;
    }
    if (data.health !== undefined) {
      const wasDead = this.ship.health <= 0;
      const wasExploding = this.ship.exploding;
      const oldHealth = this.ship.health;
      this.ship.health = data.health;

      // Debug logging for health updates
      if (oldHealth !== data.health) {
        logger.debug('HEALTH_UPDATE', 'Health changed', {
          playerId: this.id,
          oldHealth,
          newHealth: data.health,
          wasDead,
          wasExploding,
          exploding: this.ship.exploding,
          type: this.type,
        });
      }

      // If health reaches 0, trigger explosion
      if (this.ship.health <= 0 && oldHealth > 0) {
        logger.debug('HEALTH_UPDATE', 'Health reached 0, triggering explosion', {
          playerId: this.id,
          oldHealth,
          newHealth: this.ship.health,
          type: this.type,
        });
        this.ship.explode('server-damage');
      }

      // If we were dead/exploding and now have health, reset local spawn protection visuals
      if ((wasDead || wasExploding) && this.ship.health > 0) {
        logger.debug('RESPAWN_PROTECTION', 'Setting respawn protection', {
          playerId: this.id,
          settingBlinkCount: Math.ceil(
            SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
          ),
          settingSpawnProtectionTimer: SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES,
          type: this.type,
        });

        this.ship.blinkCount = Math.ceil(
          SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
        );
        this.ship.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
        this.ship.setBlinkOn();
      } else if (this.ship.health > 0 && this.type === 'local') {
        // Additional debug for local player health updates that don't trigger respawn protection
        logger.debug(
          'HEALTH_UPDATE_LOCAL',
          'Local player health update without respawn protection',
          {
            playerId: this.id,
            oldHealth,
            newHealth: data.health,
            wasDead,
            wasExploding,
            exploding: this.ship.exploding,
            condition: `wasDead: ${wasDead}, wasExploding: ${wasExploding}, health > 0: ${this.ship.health > 0}`,
          }
        );
      }
    }
    if (data.maxHealth !== undefined) {
      this.ship.maxHealth = data.maxHealth;
    }
    // Handle respawn timer from server
    if (data.respawnTimer !== undefined) {
      // When respawnTimer is 0, the server has respawned the player
      if (data.respawnTimer === 0 && this.ship.health <= 0) {
        logger.debug('RESPAWN', 'Player respawned by server', {
          playerId: this.id,
          newHealth: data.health,
          newPosition: data.position,
        });
        // Call respawn method to reset local state
        this.respawn();
      }
    }

    this.lastUpdate = Date.now();
  }

  // Respawn method implementation
  respawn(): void {
    logger.debug('RESPAWN', 'Player respawn method called', {
      playerId: this.id,
      currentHealth: this.ship.health,
      currentPosition: this.ship.position,
    });

    // Reset health to full
    this.ship.health = this.ship.maxHealth;

    // Reset explosion state
    this.ship.exploding = false;
    this.ship.explodeTime = 0;

    // Reset velocity
    this.ship.velocity = { x: 0, y: 0 };

    // Set spawn protection
    this.ship.blinkCount = Math.ceil(
      SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
    );
    this.ship.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
    this.ship.setBlinkOn();

    logger.debug('RESPAWN', 'Player respawn completed', {
      playerId: this.id,
      newHealth: this.ship.health,
      spawnProtection: this.ship.blinkCount,
    });
  }

  // Getter for spawn protection status
  get spawnProtectedUntil(): number {
    return this.ship.spawnProtectionTimer;
  }

  // Getter for death status
  get isDead(): boolean {
    return this.ship.health <= 0;
  }

  // Handle ship explosion event
  onShipExploded(detail?: { cause?: string }): void {
    logger.debug('SHIP_EXPLODED', 'Player ship exploded', {
      playerId: this.id,
      cause: detail?.cause,
      health: this.ship.health,
    });

    // Store death cause
    if (detail?.cause) {
      this.deathCause = detail.cause;
    }

    // The respawn will be handled by the server
    // Client just needs to wait for server updates
  }

  /**
   * Update player state using unified input system
   */
  updateFromInput(): void {
    // Update thrusting state
    this.ship.thrusting = this.input.getThrusting();

    // Update angular velocity
    this.ship.angularVelocity = this.input.getAngularVelocity();

    // Update shooting state
    if (this.input.getShooting()) {
      this.ship.shoot();
    }

    // Update EMP pulse state
    if (this.input.getEmpPulse()) {
      this.ship.empPulse();
    }
  }

  /**
   * Get friction coefficient based on player type
   */
  getFrictionCoefficient(): number {
    return this.type === 'bot' ? 0.02 : 0.01; // Bot-specific friction
  }

  // Update interpolation for smooth movement (disabled for now to fix popping issue)
  // updateInterpolation(): void {
  //   if (this.type === 'local' || !this.interpolationStartTime) {
  //     return;
  //   }
  //
  //   const now = Date.now();
  //   const elapsed = now - this.interpolationStartTime;
  //   const progress = Math.min(elapsed / this.interpolationDuration, 1);
  //
  //   // Interpolate position
  //   if (this.targetPosition) {
  //     this.ship.position.x += (this.targetPosition.x - this.ship.position.x) * progress;
  //     this.ship.position.y += (this.targetPosition.y - this.ship.position.y) * progress;
  //   }
  //
  //   // Interpolate velocity
  //   if (this.targetVelocity) {
  //     this.ship.velocity.x += (this.targetVelocity.x - this.ship.velocity.x) * progress;
  //     this.ship.velocity.y += (this.targetVelocity.y - this.ship.velocity.y) * progress;
  //   }
  //
  //   // Interpolate angle
  //   if (this.targetAngle !== undefined) {
  //     let angleDiff = this.targetAngle - this.ship.angle;
  //     // Handle angle wrapping
  //     if (angleDiff > Math.PI) {
  //       angleDiff -= 2 * Math.PI;
  //     }
  //     if (angleDiff < -Math.PI) {
  //       angleDiff += 2 * Math.PI;
  //     }
  //     this.ship.angle += angleDiff * progress;
  //   }
  //
  //   // If interpolation is complete, clear targets
  //   if (progress >= 1) {
  //     this.targetPosition = undefined;
  //     this.targetVelocity = undefined;
  //     this.targetAngle = undefined;
  //     this.interpolationStartTime = undefined;
  //   }
  // }

  // Get current state for network transmission
  getStateForNetwork(): {
    position: Position;
    velocity: Position;
    r: number;
    angle: number;
    lives: number;
    score: number;
    exploding: boolean;
    health?: number;
    maxHealth?: number;
  } {
    return {
      position: this.ship.position,
      velocity: this.ship.velocity,
      r: this.ship.r,
      angle: this.ship.angle,
      lives: this.lives,
      score: this.score,
      exploding: this.ship.exploding,
      health: this.ship.health,
      maxHealth: this.ship.maxHealth,
    };
  }
}
