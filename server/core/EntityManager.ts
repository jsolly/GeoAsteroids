import { WebSocket } from 'ws';
import type { Position, Velocity } from '../../shared-types';
import { BOT_AI, BotBrain, makeBotShot, type BotShot } from '../ai/botController';
import { applyShipMotionSteps, containShipInArena } from '../ai/shipMotion';
import { RNGService } from './RNGService';
import { DEBUG, PALETTE, SHIP } from '../../src/constants';
import { logger } from '../../setup/serverLogger';

export const RESPAWN_ANCHOR_ACK_DISTANCE = 100;

export interface GameEntity {
  id: string;
  name: string;
  type: 'human' | 'bot';
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  thrusting: boolean;
  color: string;
  lives: number;
  score: number;
  health: number;
  maxHealth: number;
  lastUpdate: number;
  respawnTimer?: number;
  spawnProtectionTimer?: number;
  /** Server spawn point held until the client echoes a nearby transform. */
  respawnAnchor?: Position;
  ws?: WebSocket; // Only for human players
  explodeTime?: number; // For bot explosion handling
}

/** True when a client update is still the death pose, not the new spawn. */
export function isStaleDeathPose(
  anchor: Position | undefined,
  position: Position | undefined
): boolean {
  if (!anchor || !position) {
    return false;
  }
  return Math.hypot(position.x - anchor.x, position.y - anchor.y) > RESPAWN_ANCHOR_ACK_DISTANCE;
}


export class EntityManager {
  private entities = new Map<string, GameEntity>();
  private rng: RNGService;
  private isCreatingBots = false;
  private readonly botBrain = new BotBrain();

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  // Entity management
  public addEntity(entity: GameEntity): void {
    this.entities.set(entity.id, entity);
    logger.debug('ENTITY', `Added ${entity.type} entity: ${entity.name} (${entity.id})`);
  }

  public getEntity(entityId: string): GameEntity | undefined {
    return this.entities.get(entityId);
  }

  public getAllEntities(): GameEntity[] {
    return Array.from(this.entities.values());
  }

  public getHumanPlayers(): GameEntity[] {
    return Array.from(this.entities.values()).filter(entity => entity.type === 'human');
  }

  public getBots(): GameEntity[] {
    return Array.from(this.entities.values()).filter(entity => entity.type === 'bot');
  }

  public getEntityCount(): number {
    return this.entities.size;
  }

  public getHumanPlayerCount(): number {
    return this.getHumanPlayers().length;
  }

  public getBotCount(): number {
    return this.getBots().length;
  }

  public updateEntity(entityId: string, updates: Partial<GameEntity>): GameEntity | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return undefined;
    }

    // Ignore any updates to id since it's the Map key
    const { id: ignoredId, ...allowedUpdates } = updates;

    // Validate and apply maxHealth first
    if (typeof allowedUpdates.maxHealth === 'number' && Number.isFinite(allowedUpdates.maxHealth)) {
      entity.maxHealth = Math.max(1, allowedUpdates.maxHealth);
    }

    // Validate and apply health, clamped to [0, entity.maxHealth]
    if (typeof allowedUpdates.health === 'number' && Number.isFinite(allowedUpdates.health)) {
      entity.health = Math.max(0, Math.min(entity.maxHealth, allowedUpdates.health));
    }

    // Apply other allowed properties
    const { maxHealth: ignoredMaxHealth, health: ignoredHealth, ...otherUpdates } = allowedUpdates;
    Object.assign(entity, otherUpdates);

    // Update lastUpdate timestamp
    entity.lastUpdate = Date.now();

    return entity;
  }

  public removeEntity(entityId: string): GameEntity | undefined {
    const entity = this.entities.get(entityId);
    if (entity) {
      this.entities.delete(entityId);
      logger.debug('ENTITY', `Removed ${entity.type} entity: ${entity.name} (${entityId})`);
    }
    return entity;
  }

  // Human player management
  public addHumanPlayer(id: string, name: string, ws: WebSocket, position?: Position, color?: string): GameEntity {
    const entity: GameEntity = {
      id,
      name,
      type: 'human',
      position: position || { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      angle: 0,
      exploding: false,
      thrusting: false,
      color: color || PALETTE.REMOTE,
      lives: 3,
      score: 0,
      health: 100,
      maxHealth: 100,
      lastUpdate: Date.now(),
      spawnProtectionTimer: SHIP.INVINCIBILITY_DURATION_FRAMES,
      ws,
    };

    this.addEntity(entity);
    return entity;
  }

  // Bot management
  public createBots(count: number, bounds = { radius: 3100 }): GameEntity[] {
    // Clear existing bots
    const existingBots = this.getBots();
    for (const bot of existingBots) {
      this.removeEntity(bot.id);
    }

    const botNames = [
      'Crimson Falcon', 'Nebula Viper', 'Quantum Ranger', 'Cosmic Specter',
      'Lunar Guardian', 'Solar Sentinel', 'Galactic Hunter', 'Star Warden',
      'Nova Enforcer', 'Meteor Striker'
    ];

    // Use DEBUG bot count if available
    const botCount = DEBUG.BOT_PLAYER.COUNT ?? count;

    // Use a separate seed sequence for bots to avoid interference with asteroids
    const originalState = this.rng.getState();
    this.rng.setState(0x9E3779B9 + 0x12345678); // Different seed for bots

    const newBots: GameEntity[] = [];

    for (let i = 0; i < Math.min(botCount, botNames.length); i++) {
      const botId = `server-bot-${i}`;
      // Generate random position within circular boundary
      const angle = this.rng.random() * Math.PI * 2;
      const radius = this.rng.random() * bounds.radius * 0.8; // Stay within 80% of boundary
      const position = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      };

      const botName = botNames[i];
      if (botName === undefined) {
        continue;
      }

      const bot: GameEntity = {
        id: botId,
        name: botName,
        type: 'bot',
        position,
        velocity: { x: 0, y: 0 },
        angle,
        exploding: false,
        thrusting: false,
        color: PALETTE.BOT,
        lives: 3,
        score: 0,
        health: 100,
        maxHealth: 100,
        lastUpdate: Date.now(),
        spawnProtectionTimer: SHIP.INVINCIBILITY_DURATION_FRAMES,
      };

      this.addEntity(bot);
      newBots.push(bot);
    }

    // Restore original RNG state
    this.rng.setState(originalState);

    return newBots;
  }

  // Damage system
  public damageEntity(entityId: string, damage: number): GameEntity | null {
    const entity = this.entities.get(entityId);
    if (!entity || entity.exploding || entity.health <= 0) {
      return null;
    }

    // Check spawn protection for both humans and bots
    if (entity.spawnProtectionTimer !== undefined && entity.spawnProtectionTimer > 0) {
      if (entity.type === 'bot') {
        // Bot spawn protection can be disabled via debug flag
        if (DEBUG.BOT_PLAYER.SPAWN_PROTECTION) {
          return null;
        }
      } else {
        // Humans always have spawn protection when timer > 0
        return null;
      }
    }

    const wasAlive = entity.health > 0;
    entity.health = Math.max(0, entity.health - damage);

    // If entity is destroyed, set exploding state
    if (entity.health <= 0 && wasAlive) {
      entity.exploding = true;
      // Set explosion timer for all entity types
      entity.explodeTime = SHIP.EXPLODE_DURATION_FRAMES;
    }

    entity.lastUpdate = Date.now();
    return entity;
  }

  // Shared ship explosion: tick the animation, then start a respawn countdown.
  // Do not restore health/position here and do not reset an existing timer
  // (GameEngine already schedules humans at death — resetting stacked a second 3s).
  public updateExplosions(): string[] {
    const finishedExploding: string[] = [];

    for (const [entityId, entity] of this.entities) {
      if (!entity.exploding || !entity.explodeTime || entity.explodeTime <= 0) {
        continue;
      }

      entity.explodeTime--;
      if (entity.explodeTime > 0) {
        continue;
      }

      entity.exploding = false;
      if (entity.respawnTimer === undefined && entity.lives > 0) {
        entity.respawnTimer = SHIP.RESPAWN_DELAY_FRAMES;
      }
      finishedExploding.push(entityId);
    }

    return finishedExploding;
  }

  // Shared ship respawn for humans and bots.
  public updateRespawns(): string[] {
    const finishedRespawning: string[] = [];

    for (const [entityId, entity] of this.entities) {
      if (entity.respawnTimer !== undefined) {
        if (entity.respawnTimer > 0) {
          entity.respawnTimer--;
        }

        if (entity.respawnTimer === 0) {
          this.respawnShip(entity);
          finishedRespawning.push(entityId);
          logger.debug('ENTITY', `Respawned ${entity.type} entity: ${entity.name} (${entityId})`, {
            health: entity.health,
            position: entity.position,
            spawnProtection: entity.spawnProtectionTimer,
          });
          continue;
        }
      }

      if (entity.spawnProtectionTimer !== undefined) {
        if (entity.spawnProtectionTimer > 0) {
          entity.spawnProtectionTimer--;
        }

        if (entity.spawnProtectionTimer === 0) {
          entity.spawnProtectionTimer = undefined;
          entity.respawnAnchor = undefined;
        }
      }
    }

    return finishedRespawning;
  }

  private respawnShip(entity: GameEntity): void {
    entity.respawnTimer = undefined;
    entity.health = entity.maxHealth;
    entity.exploding = false;
    entity.explodeTime = undefined;
    this.placeEntityInArena(entity);
    entity.spawnProtectionTimer = SHIP.INVINCIBILITY_DURATION_FRAMES;
    entity.respawnAnchor = { x: entity.position.x, y: entity.position.y };
  }

  private placeEntityInArena(entity: GameEntity, boundsRadius = 3100): void {
    const respawnRadius = boundsRadius * 0.8;
    const angle = this.rng.random() * Math.PI * 2;
    const radius = this.rng.random() * respawnRadius;
    entity.position = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
    entity.angle = this.rng.random() * Math.PI * 2;
    entity.velocity = { x: 0, y: 0 };
  }

  // Controller-driven bot step. Same hull physics as players; only the brain is unique.
  public updateBotMovement(): BotShot[] {
    if (!DEBUG.BOT_PLAYER.MOVEMENT) {
      return [];
    }

    const bots = this.getBots();
    this.botBrain.forgetMissing(bots.map((bot) => bot.id));

    if (bots.length > 0 && this.rng.random() < 0.002) {
      logger.info('🤖', `Updating movement for ${bots.length} bots`);
    }

    const humans = this.getHumanPlayers();
    const shots: BotShot[] = [];

    for (const bot of bots) {
      if (bot.exploding || bot.health <= 0 || bot.respawnTimer !== undefined) {
        continue;
      }

      const decision = this.botBrain.decide(bot, humans, this.rng);
      bot.angle = decision.angle;
      bot.thrusting = decision.thrusting;

      if (decision.fire) {
        shots.push(makeBotShot(bot));
      }

      applyShipMotionSteps(bot, BOT_AI.MOTION_STEPS);
      containShipInArena(bot);
      bot.lastUpdate = Date.now();
    }

    return shots;
  }

  // Cleanup
  public cleanupStaleEntities(): string[] {
    const now = Date.now();
    const removedEntities: string[] = [];

    for (const [entityId, entity] of this.entities) {
      // Only cleanup human players (bots are managed by server)
      if (entity.type === 'human' && now - entity.lastUpdate > 30000) { // 30 seconds
        this.removeEntity(entityId);
        removedEntities.push(entityId);
      }
    }

    return removedEntities;
  }

  // Atomic bot creation to prevent race conditions
  public createBotsSafely(count: number, bounds = { radius: 3100 }): GameEntity[] | null {
    if (this.isCreatingBots) {
      return null; // Already creating bots
    }

    this.isCreatingBots = true;
    try {
      if (this.getBotCount() === 0) {
        return this.createBots(count, bounds);
      }
      return null; // Bots already exist
    } finally {
      this.isCreatingBots = false;
    }
  }

  public isCreating(): boolean {
    return this.isCreatingBots;
  }


  public clearAll(): void {
    this.entities.clear();
    this.botBrain.clear();
  }
}