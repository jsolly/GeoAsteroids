import { IBotPlayer, IBotShoot, IBotBullet } from './types/multiplayer.js';
import { Vector } from './vector.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './simpleLogger.js';
import {
  SHIP_THRUST,
  FRICTION,
  FPS,
  SHIP_INV_DUR,
  SHIP_INV_BLINK_DUR,
  SHIP_EXPLODE_DUR,
  BOT_MAX_HEALTH,
  BOT_HEALTH_REGEN_RATE,
  BOT_HEALTH_REGEN_DELAY,
} from './constants.js';
import { Laser } from './ship.js';
import { LASER_SPEED, LASER_DIST, getCVS } from './constants.js';

// Enhanced bot movement with steering behaviors
interface BotSteering {
  desired: Vector;
  steering: Vector;
  maxSpeed: number;
  maxForce: number;
  wanderAngle: number;
  wanderRadius: number;
  wanderDistance: number;
  wanderJitter: number;
  rotationVelocity: number; // Added: rotation velocity for smooth rotation
  targetRotation: number; // Added: target rotation angle
}

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, IBotPlayer> = new Map();
  private botBullets: Map<string, IBotBullet> = new Map();
  private botLasers: Map<string, Laser[]> = new Map();
  private localPlayerId: string;
  private localPlayerPosition: Vector = new Vector(0, 0);
  private localPlayerAlive: boolean = true;
  private botShootCallback?: (botShoot: IBotShoot) => void;
  private isActive: boolean = false;

  // Enhanced steering data for each bot
  private botSteering: Map<string, BotSteering> = new Map();

  private constructor() {
    this.localPlayerId = uuidv4();
  }

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  public setLocalPlayerInfo(
    id: string,
    position: Vector,
    alive: boolean,
  ): void {
    this.localPlayerId = id;
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;
  }

  public setBotShootCallback(callback: (botShoot: IBotShoot) => void): void {
    this.botShootCallback = callback;
  }

  public activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    logger.bot('MANAGER', 'Bot manager activated');

    // Start bot behavior updates
    this.startBotBehaviorLoop();
  }

  public deactivate(): void {
    this.isActive = false;
    logger.bot('MANAGER', 'Bot manager deactivated');
  }

  public createBots(count: number = 3): void {
    if (!this.isActive) return;

    console.info('BOT_MANAGER', 'Creating bots', {
      count,
      isActive: this.isActive,
    });

    // Clear existing bots
    this.bots.clear();
    this.botSteering.clear();

    const botTypes: Array<'aggressive' | 'defensive' | 'patrol'> = [
      'aggressive',
      'defensive',
      'patrol',
    ];

    for (let i = 0; i < count; i++) {
      const botId = `bot-${uuidv4()}`;
      const botType = botTypes[i % botTypes.length];

      // Position bots around the edges of the screen
      const position = this.getBotStartingPosition(i);

      const bot: IBotPlayer = {
        id: botId,
        name: `Bot_${botType.charAt(0).toUpperCase()}_${i + 1}`,
        position: position,
        velocity: new Vector(0, 0),
        r: 25, // Increased from 15 to 25 for better hit detection
        a: 0, // Start facing right (toward player if player is at origin)
        lives: 3,
        score: Math.floor(Math.random() * 2000),
        dead: false,
        exploding: false,
        explodeTime: 0, // Initialize explosion time
        lastUpdate: Date.now(),
        isBot: true,
        botType,
        lastShotTime: 0,
        shotCooldown: this.getBotShotCooldown(botType),
        behaviorState: 'hunting', // Start in hunting mode - bots only hunt, never evade
        lastBehaviorChange: Date.now(),
        thrusterActive: false, // Initialize thruster state
        respawnTimer: undefined as number | undefined, // Initialize respawn timer
        lastPosition: position, // Initialize last position for smoothing
        lastRotation: 0, // Initialize last rotation to match facing angle for smoothing
        blinkOn: true, // Initialize blinking state for invincibility
        blinkCount: Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR), // Initialize blink count for invincibility
        blinkTime: Math.ceil(SHIP_INV_BLINK_DUR * FPS), // Initialize blink timer for invincibility
        spawnProtectedUntil: Date.now() + SHIP_INV_DUR * 1000, // Wall-clock based invincibility window
        // Health system properties (same as player ship)
        health: BOT_MAX_HEALTH,
        maxHealth: BOT_MAX_HEALTH,
        lastDamageTime: 0,
        healthRegenTimer: 0,
      };

      // Initialize steering behavior for this bot
      const steering: BotSteering = {
        desired: new Vector(0, 0),
        steering: new Vector(0, 0),
        maxSpeed: this.getBotMaxSpeed(botType),
        maxForce: this.getBotMaxForce(botType),
        wanderAngle: Math.random() * Math.PI * 2,
        wanderRadius: 15 + Math.random() * 10,
        wanderDistance: 50 + Math.random() * 30,
        wanderJitter: 0.3 + Math.random() * 0.4,
        rotationVelocity: 0, // Initialize rotation velocity
        targetRotation: 0, // Initialize target rotation to face right
      };

      this.bots.set(botId, bot);
      this.botSteering.set(botId, steering);

      // Add detailed debug logging for bot creation
      console.info('BOT_MANAGER', `Created ${botType} bot with invincibility`, {
        botId,
        name: bot.name,
        position: { x: position.x, y: position.y },
        blinkCount: bot.blinkCount,
        blinkTime: bot.blinkTime,
        spawnProtectedUntil: bot.spawnProtectedUntil,
        currentTime: Date.now(),
        invincibleUntil: Date.now() + SHIP_INV_DUR * 1000,
        health: bot.health,
        lives: bot.lives,
        dead: bot.dead,
        exploding: bot.exploding,
      });

      // Verify invincibility is properly set
      const isInvincible =
        bot.blinkCount > 0 || bot.spawnProtectedUntil > Date.now();
      if (!isInvincible) {
        console.error(
          'BOT_INVINCIBILITY_ERROR',
          'Bot created without invincibility!',
          {
            botId,
            name: bot.name,
            blinkCount: bot.blinkCount,
            spawnProtectedUntil: bot.spawnProtectedUntil,
            currentTime: Date.now(),
          },
        );
      } else {
        console.info(
          'BOT_INVINCIBILITY_OK',
          'Bot invincibility properly initialized',
          {
            botId,
            name: bot.name,
            isInvincible,
            blinkCount: bot.blinkCount,
            spawnProtectedUntil: bot.spawnProtectedUntil,
          },
        );
      }

      logger.bot('STEERING', 'Steering data created for bot', {
        botId,
        name: bot.name,
        botType,
        maxSpeed: steering.maxSpeed,
        maxForce: steering.maxForce,
      });

      logger.bot('MANAGER', `Created ${botType} bot`, {
        botId,
        name: bot.name,
        position: { x: position.x, y: position.y },
      });
    }

    console.info('BOT_MANAGER', 'Finished creating bots', {
      totalBots: this.bots.size,
      botIds: Array.from(this.bots.keys()),
    });
  }

  public getBots(): Map<string, IBotPlayer> {
    return this.bots;
  }

  public getBotBullets(): Map<string, IBotBullet> {
    return this.botBullets;
  }

  public getBotLasers(): Map<string, Laser[]> {
    return this.botLasers;
  }

  // Compatibility shim for legacy tests and tooling
  public createBotBullet(botShoot: IBotShoot): void {
    const bulletId = `bullet-${uuidv4()}`;
    const bullet: IBotBullet = {
      id: bulletId,
      botId: botShoot.botId,
      position: new Vector(botShoot.laserStart.x, botShoot.laserStart.y),
      direction: new Vector(
        botShoot.laserDirection.x,
        botShoot.laserDirection.y,
      ),
      speed: 8,
      distanceTraveled: 0,
      maxDistance: 800,
      createdAt: Date.now(),
    };

    this.botBullets.set(bulletId, bullet);
    console.info('BOT_BULLET', 'Bot bullet created (compat shim)', {
      bulletId,
      botId: botShoot.botId,
      totalBullets: this.botBullets.size,
    });
  }

  public createBotLaser(botShoot: IBotShoot): void {
    const shooter = this.bots.get(botShoot.botId);
    const start = new Vector(botShoot.laserStart.x, botShoot.laserStart.y);
    const direction = new Vector(
      botShoot.laserDirection.x,
      botShoot.laserDirection.y,
    );

    // Match player laser physics: velocity = facing direction * LASER_SPEED/FPS + current velocity
    const baseVelocity = direction.multiply(LASER_SPEED / FPS);
    const addedVelocity = shooter ? shooter.velocity : new Vector(0, 0);
    const velocity = baseVelocity.add(addedVelocity);

    const laser = new Laser(start, velocity, 0, 0);
    const lasers = this.botLasers.get(botShoot.botId) || [];
    lasers.push(laser);
    this.botLasers.set(botShoot.botId, lasers);

    console.info('BOT_LASER', 'Bot laser created', {
      botId: botShoot.botId,
      startPos: { x: start.x, y: start.y },
      velocity: { x: velocity.x, y: velocity.y },
      lasersForBot: lasers.length,
    });
  }

  public updateBotBullets(): void {
    // Legacy no-op retained for compatibility; lasers are now the projectile system
    this.updateBotLasers();
  }

  public updateBotLasers(): void {
    if (this.botLasers.size === 0) return;

    const cvs = getCVS();
    for (const [botId, lasers] of this.botLasers.entries()) {
      for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];

        if (laser.explodeTime > 0) {
          laser.explodeTime--;
          if (laser.explodeTime === 0) {
            lasers.splice(i, 1);
            continue;
          }
        } else {
          laser.position = laser.position.add(laser.velocity);
          laser.distTraveled += laser.velocity.magnitude();
        }

        // Match player removal logic using LASER_DIST and canvas width if available
        if (cvs && laser.distTraveled >= LASER_DIST + cvs.width) {
          lasers.splice(i, 1);
          continue;
        }
      }

      if (lasers.length === 0) {
        this.botLasers.delete(botId);
      } else {
        this.botLasers.set(botId, lasers);
      }
    }
  }

  // Legacy bullet helper removed (lasers are now used)

  public removeBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      console.info('BOT_MANAGER', 'Removing bot', { botId, name: bot.name });
      this.bots.delete(botId);
    }
  }

  public clearBots(): void {
    this.bots.clear();
    this.botBullets.clear(); // Also clear any active bullets
    this.botLasers.clear();
    console.info('BOT_MANAGER', 'All bots and bullets cleared');
  }

  public clearBotBullets(): void {
    this.botBullets.clear();
    console.info('BOT_MANAGER', 'All bot bullets cleared');
  }

  public clearBotLasers(): void {
    this.botLasers.clear();
    console.info('BOT_MANAGER', 'All bot lasers cleared');
  }

  private getBotStartingPosition(index: number): Vector {
    // Use world coordinates instead of canvas coordinates
    // Position bots at a moderate distance from the world origin (0, 0) where the ship starts
    const margin = 150; // Moderate distance for dramatic entrance

    // Mix of positions around the center for dramatic hunting
    const positions = [
      new Vector(-margin, -margin), // Top-left
      new Vector(margin, -margin), // Top-right
      new Vector(margin, margin), // Bottom-right
      new Vector(-margin, margin), // Bottom-left
      new Vector(margin, 0), // Right of world center
      new Vector(-margin, 0), // Left of world center
      new Vector(0, margin), // Below world center
      new Vector(0, -margin), // Above world center
    ];

    return positions[index % positions.length];
  }

  private getBotShotCooldown(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 300 + Math.random() * 700; // 0.3-1.0 seconds (much more aggressive)
      case 'defensive':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds (more aggressive)
      case 'patrol':
        return 400 + Math.random() * 800; // 0.4-1.2 seconds (more aggressive)
      default:
        return 500;
    }
  }

  private getBotMaxSpeed(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 4.0 + Math.random() * 1.5; // 4.0-5.5
      case 'defensive':
        return 3.5 + Math.random() * 1.0; // 3.5-4.5
      case 'patrol':
        return 3.8 + Math.random() * 1.2; // 3.8-5.0
      default:
        return 4.0;
    }
  }

  private getBotMaxForce(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 2.0 + Math.random() * 1.0; // 2.0-3.0
      case 'defensive':
        return 1.5 + Math.random() * 0.8; // 1.5-2.3
      case 'patrol':
        return 1.8 + Math.random() * 1.0; // 1.8-2.8
      default:
        return 2.0;
    }
  }

  private startBotBehaviorLoop(): void {
    // Note: Bot updates are now integrated into the main game loop
    // This ensures bots update at the same framerate as the player ship
    console.info(
      'BOT_MANAGER',
      'Bot behavior loop started - integrated with main game loop',
    );
  }

  private updateBotBehavior(): void {
    const now = Date.now();

    for (const [, bot] of this.bots.entries()) {
      // Skip dead bots and bots that are exploding
      if (bot.dead || bot.exploding) continue;

      // Update behavior state less frequently to reduce flickering
      if (now - bot.lastBehaviorChange > 5000 + Math.random() * 8000) {
        // Increased to 5-13 seconds
        this.updateBotBehaviorState(bot);
      }

      // Move bot based on behavior
      this.moveBot(bot);

      // Update timestamp
      bot.lastUpdate = now;
    }

    // Log that behavior loop is running (but not every frame to avoid spam)
    if (this.bots.size > 0 && now % 1000 < 100) {
      // Log roughly once per second
      // console.debug('BOT_BEHAVIOR_LOOP', 'Bot behavior loop running', {
      //   activeBots: this.bots.size,
      //   timestamp: now
      // });
    }
  }

  private updateBotBehaviorState(bot: IBotPlayer): void {
    const now = Date.now();

    // Always hunt - no evading, no patrolling
    bot.behaviorState = 'hunting'; // 100% hunting

    // No random behavior changes - bots stay focused on hunting
    // This prevents them from randomly switching to patrolling and wandering away

    bot.lastBehaviorChange = now;
    // console.debug('BOT_MANAGER', 'Bot behavior state changed', {
    //   botId: bot.id,
    //   name: bot.name,
    //   newState: bot.behaviorState
    // });
  }

  /**
   * Get a personality factor that influences bot behavior
   */
  private getBotPersonalityFactor(bot: IBotPlayer): number {
    // Use bot ID to create consistent personality
    const hash = bot.id.split('').reduce((a, b) => {
      a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
      return a;
    }, 0);

    // Return a value between 0 and 1
    return (hash & 0xff) / 255;
  }

  private moveBot(bot: IBotPlayer): void {
    const steering = this.botSteering.get(bot.id);
    if (!steering) {
      console.info(
        'BOT_MOVEMENT',
        'No steering data for bot, using fallback movement',
        {
          botId: bot.id,
          name: bot.name,
          botType: bot.botType,
        },
      );
      return;
    }

    // const originalPosition = new Vector(bot.position.x, bot.position.y);

    // Determine if bot should thrust based on behavior
    let shouldThrust = false;
    let thrustDirection = bot.a; // Default to current facing direction

    switch (bot.behaviorState) {
      case 'hunting': {
        if (this.localPlayerAlive) {
          // Calculate direction to player
          const direction = this.localPlayerPosition.subtract(bot.position);
          const distance = direction.magnitude();

          if (distance > 0) {
            // Use unified angle convention matching Vector.fromAngle(cos, -sin)
            // Negate Y to convert world Y-down to math Y-up for atan2
            thrustDirection = Math.atan2(-direction.y, direction.x);

            // Always thrust when hunting - no distance threshold
            shouldThrust = true;
          }
        }
        break;
      }

      // Evading removed - bots only hunt now
    }

    // Update bot rotation to face the desired direction BEFORE thrusting
    // This ensures the bot faces where it wants to go, then thrusts in that direction
    this.updateBotRotation(bot, thrustDirection);

    // If we're still turning a lot, don't thrust yet (prevents initial run-away)
    let angleOk = true;
    {
      let diff = Math.abs(thrustDirection - bot.a);
      diff = Math.min(diff, Math.PI * 2 - diff);
      angleOk = diff < 0.6; // ~34 degrees tolerance
    }

    // Apply thrust like the player ship does - ALWAYS in the direction the bot is facing
    if (shouldThrust && angleOk && !bot.dead) {
      // CRITICAL: Thrust must be in the direction the bot is facing (bot.a), not thrustDirection
      // This matches the player ship physics: Vector.fromAngle(this.a).multiply(SHIP_THRUST / FPS)
      const thrust = Vector.fromAngle(bot.a).multiply(SHIP_THRUST / FPS); // Exact same physics as player ship
      bot.velocity = bot.velocity.add(thrust);
      bot.thrusterActive = true;

      // Log thrust application
      console.info('BOT_THRUST', 'Bot applied thrust in facing direction', {
        botId: bot.id,
        name: bot.name,
        behaviorState: bot.behaviorState,
        botFacingAngle: Math.round((bot.a * 180) / Math.PI),
        desiredDirection: Math.round((thrustDirection * 180) / Math.PI),
        thrustForce: {
          x: Math.round(thrust.x * 1000) / 1000,
          y: Math.round(thrust.y * 1000) / 1000,
        },
      });
    } else {
      bot.thrusterActive = false;

      // Apply friction when not thrusting (same as player ship)
      bot.velocity = bot.velocity.multiply(1 - FRICTION / FPS); // Exact same physics as player ship

      // No random movement - this would violate ship physics rules
      // Bots should only move when thrusting, just like the player ship
    }

    // Move the bot using velocity (same as player ship)
    bot.position = bot.position.add(bot.velocity);

    // Add position smoothing to reduce flickering - reduced for stability
    if (bot.lastPosition) {
      const smoothingFactor = 0.1; // Reduced from 0.3 for more direct movement
      bot.position = bot.lastPosition
        .multiply(1 - smoothingFactor)
        .add(bot.position.multiply(smoothingFactor));
    }
    bot.lastPosition = new Vector(bot.position.x, bot.position.y);

    // Log movement for debugging (disabled to prevent spam)
    // const newPosition = bot.position;
    // const movementDistance = newPosition.distance(originalPosition);

    // if (movementDistance > 0.1) {
    //   console.info('BOT_MOVEMENT', 'Bot moved like ship', {
    //     botId: bot.id,
    //     name: bot.name,
    //     botType: bot.botType,
    //     behaviorState: bot.behaviorState,
    //     from: {
    //       x: Math.round(originalPosition.x * 100) / 100,
    //       y: Math.round(originalPosition.y * 100) / 100,
    //     },
    //     to: {
    //       x: Math.round(newPosition.x * 100) / 100,
    //       y: Math.round(newPosition.y * 100) / 100,
    //     },
    //     movementDistance: Math.round(movementDistance * 100) / 100,
    //     velocity: {
    //       x: Math.round(bot.velocity.x * 100) / 100,
    //       y: Math.round(bot.velocity.y * 100) / 100,
    //     },
    //     thrusting: shouldThrust && angleOk,
    //     thrustDirection: Math.round((thrustDirection * 180) / Math.PI),
    //   });
    // }
  }

  /**
   * Smoothly rotate a bot towards a target angle with natural momentum
   */
  private smoothBotRotation(bot: IBotPlayer, targetAngle: number): void {
    const steering = this.botSteering.get(bot.id);
    if (!steering) return;

    // Update target rotation
    steering.targetRotation = targetAngle;

    // Calculate the shortest rotation direction
    let angleDiff = targetAngle - bot.a;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Only rotate if the difference is significant enough to matter
    if (Math.abs(angleDiff) < 0.01) return;

    // Calculate rotation acceleration based on bot type - reduced for stability
    let rotationAcceleration: number;
    switch (bot.botType) {
      case 'aggressive':
        rotationAcceleration = 0.08; // Reduced for stability
        break;
      case 'defensive':
        rotationAcceleration = 0.06; // Reduced for stability
        break;
      case 'patrol':
        rotationAcceleration = 0.07; // Reduced for stability
        break;
      default:
        rotationAcceleration = 0.07;
    }

    // Apply rotation acceleration based on angle difference
    if (angleDiff > 0) {
      steering.rotationVelocity += rotationAcceleration;
    } else {
      steering.rotationVelocity -= rotationAcceleration;
    }

    // Limit rotation velocity - reduced for stability
    const maxRotationVelocity = 0.4; // Reduced from 0.8 for stability
    steering.rotationVelocity = Math.max(
      -maxRotationVelocity,
      Math.min(maxRotationVelocity, steering.rotationVelocity),
    );

    // Apply rotation velocity to angle
    bot.a += steering.rotationVelocity;

    // Apply rotation damping (friction) - increased for stability
    steering.rotationVelocity *= 0.7; // Increased damping for more stable rotation

    // Add rotation smoothing to reduce flickering - reduced for stability
    if (bot.lastRotation !== undefined) {
      const rotationSmoothingFactor = 0.2; // Reduced from 0.4 for more direct movement
      const angleDiff = bot.a - bot.lastRotation;
      // Normalize angle difference to [-π, π]
      let normalizedDiff = angleDiff;
      while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
      while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

      bot.a = bot.lastRotation + normalizedDiff * rotationSmoothingFactor;
    }
    bot.lastRotation = bot.a;

    // Keep angle in [0, 2π] range
    while (bot.a < 0) bot.a += Math.PI * 2;
    while (bot.a >= Math.PI * 2) bot.a -= Math.PI * 2;
  }

  private updateBotShooting(): void {
    const now = Date.now();

    // Log that shooting update is running (occasionally)
    if (Math.random() < 0.01) {
      // 1% chance per frame
      console.info('BOT_SHOOTING_UPDATE', 'Bot shooting update running', {
        botCount: this.bots.size,
        activeBots: Array.from(this.bots.values()).filter(
          (bot) => !bot.dead && !bot.exploding,
        ).length,
        localPlayerAlive: this.localPlayerAlive,
      });
    }

    for (const [, bot] of this.bots.entries()) {
      // Skip dead bots and bots that are exploding
      if (bot.dead || bot.exploding) continue;
      if (!this.localPlayerAlive) continue;

      // Check if bot can shoot
      if (now - bot.lastShotTime < bot.shotCooldown) {
        // Log cooldown (occasionally)
        if (Math.random() < 0.05) {
          // 5% chance per frame
          const timeSinceLastShot = now - bot.lastShotTime;
          const cooldownRemaining = bot.shotCooldown - timeSinceLastShot;
          console.info('BOT_SHOOTING_DEBUG', 'Bot on cooldown', {
            botId: bot.id,
            name: bot.name,
            timeSinceLastShot: Math.round(timeSinceLastShot),
            cooldownRemaining: Math.round(cooldownRemaining),
            shotCooldown: bot.shotCooldown,
          });
        }
        continue;
      }

      // Check if player is in range and line of sight
      if (this.canBotShootAtPlayer(bot)) {
        this.botShoot(bot);
        bot.lastShotTime = now;

        // Log successful shot
        console.info('BOT_SHOOTING', 'Bot successfully shot at player', {
          botId: bot.id,
          name: bot.name,
          botType: bot.botType,
          distance: this.getDistanceToPlayer(bot.position),
          botFacing: Math.round((bot.a * 180) / Math.PI),
          angleToPlayer: Math.round(
            (Math.atan2(
              -(this.localPlayerPosition.y - bot.position.y),
              this.localPlayerPosition.x - bot.position.x,
            ) *
              180) /
              Math.PI,
          ),
        });
      } else {
        // Log why bot can't shoot (occasionally to avoid spam)
        if (Math.random() < 0.1) {
          // 10% chance per frame
          const distance = this.getDistanceToPlayer(bot.position);
          const angleToPlayer = Math.atan2(
            -(this.localPlayerPosition.y - bot.position.y),
            this.localPlayerPosition.x - bot.position.x,
          );
          const angleDiff = Math.abs(angleToPlayer - bot.a);
          const normalizedAngleDiff = Math.min(
            angleDiff,
            Math.PI * 2 - angleDiff,
          );

          console.info('BOT_SHOOTING', 'Bot cannot shoot at player', {
            botId: bot.id,
            name: bot.name,
            botType: bot.botType,
            distance,
            maxRange: 400,
            botFacing: Math.round((bot.a * 180) / Math.PI),
            angleToPlayer: Math.round((angleToPlayer * 180) / Math.PI),
            angleDiff: Math.round((normalizedAngleDiff * 180) / Math.PI),
            maxAngle: 60,
            reason: distance > 400 ? 'Too far' : 'Not facing player',
          });
        }
      }
    }
  }

  private canBotShootAtPlayer(bot: IBotPlayer): boolean {
    const distance = this.getDistanceToPlayer(bot.position);

    // Bot must be within shooting range - increased for more aggressive shooting
    if (distance > 400) {
      // Log why bot can't shoot (distance)
      if (Math.random() < 0.05) {
        // 5% chance per frame to avoid spam
        console.info('BOT_SHOOTING_DEBUG', 'Bot too far to shoot', {
          botId: bot.id,
          name: bot.name,
          distance: Math.round(distance),
          maxRange: 400,
        });
      }
      return false;
    }

    // Bot must be facing roughly towards player - more lenient for aggressive shooting
    // Negate Y for atan2 to match Vector.fromAngle convention
    const angleToPlayer = Math.atan2(
      -(this.localPlayerPosition.y - bot.position.y),
      this.localPlayerPosition.x - bot.position.x,
    );

    const angleDiff = Math.abs(angleToPlayer - bot.a);
    const normalizedAngleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    // Bot must be facing within 60 degrees of player (increased from 45 for more shooting)
    const canShoot = normalizedAngleDiff < Math.PI / 3;

    // Log shooting conditions (occasionally to avoid spam)
    if (Math.random() < 0.05) {
      // 5% chance per frame
      console.info('BOT_SHOOTING_DEBUG', 'Bot shooting conditions check', {
        botId: bot.id,
        name: bot.name,
        distance: Math.round(distance),
        botFacing: Math.round((bot.a * 180) / Math.PI),
        angleToPlayer: Math.round((angleToPlayer * 180) / Math.PI),
        angleDiff: Math.round((normalizedAngleDiff * 180) / Math.PI),
        maxAngle: 60,
        canShoot,
      });
    }

    return canShoot;
  }

  private botShoot(bot: IBotPlayer): void {
    if (!this.botShootCallback) return;

    // Calculate laser direction towards player
    const direction = this.localPlayerPosition.subtract(bot.position);
    const distance = direction.magnitude();

    if (distance === 0) return;

    // Add some randomness to bot accuracy based on bot type and personality
    const accuracy = this.getBotAccuracy(bot.botType);
    const personalityFactor = this.getBotPersonalityFactor(bot);

    // Personality affects accuracy - some bots are more consistent than others
    const finalAccuracy = accuracy + (personalityFactor - 0.5) * 0.2;

    // Calculate base angle to player
    // Negate Y to match Vector.fromAngle(cos, -sin)
    const baseAngle = Math.atan2(-direction.y, direction.x);

    // Add accuracy-based randomness
    const maxSpread = ((1 - finalAccuracy) * Math.PI) / 3; // Max 60 degree spread
    const randomAngle = (Math.random() - 0.5) * maxSpread;

    // Add some intentional "personality" misses for aggressive bots
    let finalAngle = baseAngle + randomAngle;
    if (bot.botType === 'aggressive' && Math.random() < 0.15) {
      // Aggressive bots sometimes intentionally shoot wide to "herd" the player
      const herdAngle = baseAngle + ((Math.random() - 0.5) * Math.PI) / 2;
      finalAngle = herdAngle;
    }

    // Calculate laser start position (from bot's nose)
    const noseOffset = Vector.fromAngle(bot.a).multiply((4 / 3) * bot.r);
    const laserStart = bot.position.add(noseOffset);

    // Calculate laser direction using unified angle convention (cos, -sin)
    const laserDirection = Vector.fromAngle(finalAngle);

    const botShoot: IBotShoot = {
      botId: bot.id,
      laserStart,
      laserDirection,
      targetPlayerId: this.localPlayerId,
    };

    // console.debug('BOT_MANAGER', 'Bot shooting', {
    //   botId: bot.id,
    //   name: bot.name,
    //   botType: bot.botType,
    //   targetDistance: distance,
    //   accuracy: finalAccuracy,
    //   personalityFactor
    // });

    // Create a visual laser for this shot (unified with player laser)
    this.createBotLaser(botShoot);

    // Call the callback to handle the shot logic
    this.botShootCallback(botShoot);
  }

  private getBotAccuracy(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 0.8; // 80% accurate
      case 'defensive':
        return 0.9; // 90% accurate
      case 'patrol':
        return 0.7; // 70% accurate
      default:
        return 0.8;
    }
  }

  private getDistanceToPlayer(botPosition: Vector): number {
    return botPosition.distance(this.localPlayerPosition);
  }

  // Public method to update local player position (called from game loop)
  public updateLocalPlayerPosition(position: Vector, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Log position updates (occasionally to avoid spam)
    if (Math.random() < 0.05) {
      // 5% chance per frame
      console.info('BOT_MANAGER', 'Local player position updated', {
        position: { x: Math.round(position.x), y: Math.round(position.y) },
        alive,
        botCount: this.bots.size,
        activeBots: Array.from(this.bots.values()).filter(
          (bot) => !bot.dead && !bot.exploding,
        ).length,
      });
    }
  }

  // Handle bot explosion and cleanup
  public handleBotExplosion(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    // Set explosion state
    bot.exploding = true;
    bot.explodeTime = 60; // 1 second at 60 FPS

    console.info('BOT_MANAGER', 'Bot explosion started', {
      botId,
      name: bot.name,
      botType: bot.botType,
    });
  }

  // Update bot explosion states and cleanup
  public updateBotExplosions(): void {
    for (const [botId, bot] of this.bots.entries()) {
      if (bot.exploding && bot.explodeTime > 0) {
        bot.explodeTime--;

        // console.debug('BOT_EXPLOSION', 'Bot explosion in progress', {
        //   botId,
        //   name: bot.name,
        //   botType: bot.botType,
        //   explodeTimeRemaining: bot.explodeTime
        // });

        // When explosion finishes, start respawn timer instead of removing bot
        if (bot.explodeTime === 0) {
          console.info(
            'BOT_EXPLOSION_COMPLETE',
            'Bot explosion finished, starting respawn timer',
            {
              botId,
              name: bot.name,
              botType: bot.botType,
            },
          );

          // Start respawn timer (5 seconds at 60 FPS = 300 frames)
          bot.respawnTimer = 300;
          bot.exploding = false;
          bot.dead = false;

          // Store respawn position (same as original position for now)
          bot.respawnPosition = new Vector(bot.position.x, bot.position.y);
        }
      }

      // Handle respawn timer
      if (bot.respawnTimer !== undefined && bot.respawnTimer > 0) {
        bot.respawnTimer--;

        if (bot.respawnTimer === 0) {
          // Respawn the bot
          this.respawnBot(botId);
        }
      }
    }
  }

  // Debug method to show bot state
  public debugBotState(): void {
    // console.info('BOT_MANAGER', 'Bot Debug State', {
    //   active: this.isActive,
    //   botCount: this.bots.size,
    //   bots: Array.from(this.bots.values()).map(bot => ({
    //     id: bot.id,
    //     name: bot.name,
    //     type: bot.botType,
    //     state: bot.behaviorState,
    //     position: { x: bot.position.x, y: bot.position.y },
    //     lives: bot.lives,
    //     lastShot: Date.now() - bot.lastShotTime
    //   }))
    // });
  }

  // Method for EMP destruction that triggers respawn system
  public empDestroyBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) {
      console.info('BOT_EMP', 'Bot not found for EMP destruction', { botId });
      return;
    }

    console.info(
      'BOT_EMP',
      'Bot destroyed by EMP, starting explosion and respawn',
      {
        botId,
        name: bot.name,
        botType: bot.botType,
      },
    );

    // Start explosion sequence (same as laser hit)
    bot.dead = true;
    bot.exploding = true;
    bot.explodeTime = 60; // 1 second explosion duration

    // Clear any bullets from this bot
    for (const [bulletId, bullet] of this.botBullets.entries()) {
      if (bullet.botId === botId) {
        this.botBullets.delete(bulletId);
      }
    }

    console.info('BOT_EMP', 'Bot explosion started for EMP destruction', {
      botId,
    });
  }

  private respawnBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot || !bot.respawnPosition) return;

    console.info('BOT_MANAGER', 'Respawn timer finished, respawning bot', {
      botId,
      name: bot.name,
      botType: bot.botType,
      respawnPosition: { x: bot.respawnPosition.x, y: bot.respawnPosition.y },
    });

    // Reset bot properties for respawn
    bot.dead = false;
    bot.exploding = false;
    bot.explodeTime = 0;
    bot.respawnTimer = undefined; // Clear respawn timer
    bot.position = bot.respawnPosition; // Move to respawn position
    bot.lives = 3; // Reset lives
    bot.score = Math.floor(Math.random() * 2000); // Reset score
    bot.behaviorState = 'hunting'; // Always resume hunting on respawn
    bot.lastBehaviorChange = Date.now();
    bot.thrusterActive = false;
    bot.lastShotTime = 0; // Reset last shot time
    bot.a = 0; // Reset rotation to face right (consistent convention)
    bot.velocity = new Vector(0, 0);
    bot.blinkOn = true;
    bot.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
    bot.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
    // Extend protection window after respawn
    bot.spawnProtectedUntil = Date.now() + SHIP_INV_DUR * 1000;

    // Reset health to full (same as player ship)
    bot.health = BOT_MAX_HEALTH;
    bot.lastDamageTime = 0;
    bot.healthRegenTimer = 0;

    // Reset steering behavior
    const steering = this.botSteering.get(botId);
    if (steering) {
      steering.wanderAngle = Math.random() * Math.PI * 2;
      steering.desired = new Vector(0, 0);
      steering.steering = new Vector(0, 0);
      steering.rotationVelocity = 0;
      steering.targetRotation = Math.random() * Math.PI * 2;
    }

    console.info('BOT_MANAGER', 'Bot respawned', {
      botId,
      name: bot.name,
      botType: bot.botType,
      position: { x: bot.position.x, y: bot.position.y },
    });
  }

  // =============
  // STEERING BEHAVIORS
  // =============

  /**
   * Update bot rotation to face the desired movement direction
   */
  private updateBotRotation(bot: IBotPlayer, desiredDirection: number): void {
    // Rotate the bot to face the direction it wants to go
    // This ensures thrust is applied in the right direction (bot.a)
    const targetAngle = desiredDirection;

    // Apply smooth rotation to the target angle
    this.smoothBotRotation(bot, targetAngle);
  }

  /**
   * Bot takes damage (same as player ship)
   */
  public botTakeDamage(bot: IBotPlayer, amount: number): void {
    if (bot.dead || bot.exploding) {
      console.debug(
        'BOT_DAMAGE_SKIP',
        'Bot damage skipped - already dead or exploding',
        {
          botId: bot.id,
          botName: bot.name,
          dead: bot.dead,
          exploding: bot.exploding,
        },
      );
      return;
    }

    // Log the damage event
    console.info('BOT_DAMAGE', 'Bot took damage!', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      damage: amount,
      previousHealth: bot.health,
      lives: bot.lives,
      position: { x: bot.position.x, y: bot.position.y },
      blinkCount: bot.blinkCount,
      spawnProtectedUntil: bot.spawnProtectedUntil,
      isInvincible: bot.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
    });

    bot.health -= amount;
    bot.lastDamageTime = FPS;
    bot.healthRegenTimer = Math.ceil(BOT_HEALTH_REGEN_DELAY * FPS);

    console.info('BOT_DAMAGE', 'Bot took damage!', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      damage: amount,
      remainingHealth: bot.health,
      lives: bot.lives,
      position: { x: bot.position.x, y: bot.position.y },
    });

    if (bot.health <= 0) {
      bot.health = 0;

      // Bot lost all health, lose a life
      bot.lives--;

      console.info(
        'BOT_LIFE_LOST',
        'Bot lost a life due to health reaching 0!',
        {
          botId: bot.id,
          botName: bot.name,
          botType: bot.botType,
          previousLives: bot.lives + 1,
          remainingLives: bot.lives,
          position: { x: bot.position.x, y: bot.position.y },
          blinkCount: bot.blinkCount,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          isInvincible:
            bot.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        },
      );

      if (bot.lives <= 0) {
        // Bot is dead, mark as dead and explode
        bot.dead = true;
        bot.exploding = true;
        bot.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
        bot.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);

        console.error('BOT_DEATH_FINAL', 'Bot died - no lives remaining', {
          botId: bot.id,
          botName: bot.name,
          botType: bot.botType,
          position: { x: bot.position.x, y: bot.position.y },
          blinkCount: bot.blinkCount,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          isInvincible:
            bot.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        });
      } else {
        // Bot still has lives, start explosion and respawn sequence
        bot.exploding = true;
        bot.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
        bot.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);

        console.info('BOT_LIFE_LOST', 'Bot lost a life!', {
          botId: bot.id,
          botName: bot.name,
          botType: bot.botType,
          remainingLives: bot.lives,
        });

        // Start respawn timer
        bot.respawnTimer = 300; // 5 seconds at 60 FPS
        // Store respawn position (same as original position for now)
        bot.respawnPosition = new Vector(bot.position.x, bot.position.y);
      }
    }
  }

  /**
   * Update bot health regeneration
   */
  private updateBotHealth(bot: IBotPlayer): void {
    if (bot.dead || bot.exploding) {
      return;
    }

    // Update health regeneration timer
    if (bot.lastDamageTime > 0) {
      bot.lastDamageTime--;
    }

    // Start health regeneration after delay
    if (bot.lastDamageTime <= 0 && bot.health < bot.maxHealth) {
      if (bot.healthRegenTimer <= 0) {
        // Heal the bot
        const oldHealth = bot.health;
        bot.health = Math.min(
          bot.health + BOT_HEALTH_REGEN_RATE / FPS,
          bot.maxHealth,
        );

        if (bot.health > oldHealth) {
          console.info('BOT_HEAL', 'Bot healed!', {
            botId: bot.id,
            botName: bot.name,
            healAmount: bot.health - oldHealth,
            newHealth: bot.health,
            maxHealth: bot.maxHealth,
          });
        }
      } else {
        bot.healthRegenTimer--;
      }
    }
  }

  /**
   * Update bot invincibility and blinking effects
   */
  private updateBotInvincibility(bot: IBotPlayer): void {
    if (bot.blinkCount > 0) {
      // Bot is invincible, update blinking
      bot.blinkTime--;
      if (bot.blinkTime <= 0) {
        bot.blinkCount--;
        bot.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        bot.blinkOn = !bot.blinkOn; // Toggle blinking state
      }

      // Debug logging for invincibility state
      if (Math.random() < 0.1) {
        // 10% chance per frame to avoid spam
        console.debug('BOT_INVINCIBILITY', 'Bot invincibility update', {
          botId: bot.id,
          botName: bot.name,
          blinkCount: bot.blinkCount,
          blinkTime: bot.blinkTime,
          blinkOn: bot.blinkOn,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
          isInvincible:
            bot.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        });
      }
    }

    // Ensure invincibility lasts at least until spawnProtectedUntil
    if (
      typeof bot.spawnProtectedUntil === 'number' &&
      Date.now() < bot.spawnProtectedUntil
    ) {
      // Keep blinkCount non-zero so collision checks that rely on it continue to skip
      if (bot.blinkCount <= 0) {
        bot.blinkCount = 1;
        bot.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        bot.blinkOn = true; // Start visible
        console.debug('BOT_INVINCIBILITY', 'Extended bot invincibility', {
          botId: bot.id,
          botName: bot.name,
          blinkCount: bot.blinkCount,
          blinkTime: bot.blinkTime,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
        });
      }
      // Don't override blinkOn here - let the blinking system work naturally
    }
  }

  /**
   * Update all bot systems at the same framerate as the main game loop
   * This ensures bots move smoothly without framerate mismatches
   */
  public updateBotsInGameLoop(): void {
    if (!this.isActive) return;

    // Update bot behavior and movement
    this.updateBotBehavior();

    // Update bot shooting
    this.updateBotShooting();

    // Update bot explosions
    this.updateBotExplosions();

    // Update bot bullets
    this.updateBotLasers();

    // Update bot invincibility and blinking effects
    for (const bot of this.bots.values()) {
      if (!bot.dead && !bot.exploding) {
        this.updateBotInvincibility(bot);
        this.updateBotHealth(bot); // Update health regeneration
      }
    }

    // Log framerate synchronization and bot status (occasionally)
    if (Math.random() < 0.01) {
      // 1% chance per frame
      const activeBots = Array.from(this.bots.values()).filter(
        (bot) => !bot.dead && !bot.exploding,
      );
      console.info(
        'BOT_FRAMERATE',
        'Bot update synchronized with main game loop',
        {
          botCount: this.bots.size,
          activeBots: activeBots.length,
          localPlayerAlive: this.localPlayerAlive,
          localPlayerPosition: this.localPlayerAlive
            ? {
                x: Math.round(this.localPlayerPosition.x),
                y: Math.round(this.localPlayerPosition.y),
              }
            : 'unknown',
          botStates: activeBots.map((bot) => ({
            id: bot.id,
            name: bot.name,
            behavior: bot.behaviorState,
            position: {
              x: Math.round(bot.position.x),
              y: Math.round(bot.position.y),
            },
          })),
        },
      );
    }
  }
}
