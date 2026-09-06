import { WebSocket } from 'ws';
import type { AsteroidData, Position, ServerGameState } from '../../shared-types';
import { logger } from '../../setup/serverLogger';
import { AsteroidManager } from './AsteroidManager.ts';
import {
  ARENA_RADIUS,
  COMBAT_REWARDS,
  LIFECYCLE,
  shouldAcceptClientMovement,
  snapshotAsteroid,
  snapshotEntity,
} from './entityLifecycle';
import { EntityManager, GameEntity } from './EntityManager';
import { RNGService } from './RNGService';

/**
 * Rules + tick owner: combat scoring, lives, when a kill starts a respawn
 * countdown, and the 60 FPS loop that advances EntityManager lifecycle.
 * Does not parse WebSocket frames (MessageHandler) or own raw timer fields
 * (EntityManager).
 */
export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.entityManager = new EntityManager(this.rngService);
    this.asteroidManager = new AsteroidManager(this.rngService);

    // Don't initialize pause state yet - will be called after initialization
  }

  // Game loop management
  public startGameLoop(): void {
    if (this.gameLoopInterval) {
      return; // Already running
    }

    // Start game loop for cleanup and updates (60 FPS for health regeneration)
    this.gameLoopInterval = setInterval(() => {
      // Always increment game time, even when paused, to maintain consistency
      this.gameTime++;
      
      if (!this.isPaused) {
        this.tickWorld();
        if (this.gameTime % 2 === 0) {
          this.entityManager.updateBotMovement();
        }
      }
    }, 1000 / 60); // 60 FPS
  }

  public stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  /** Advance explosion → respawn → spawn protection for every ship. */
  public tickWorld(): void {
    this.entityManager.cleanupStaleEntities();
    this.entityManager.updateExplosions();
    this.entityManager.updateRespawns();
  }

  // Pause/resume functionality
  public updatePauseState(): void {
    const humanPlayerCount = this.entityManager.getHumanPlayerCount();
    
    if (humanPlayerCount === 0 && !this.isPaused) {
      this.isPaused = true;
      logger.info('🔄 Game paused - no human players online');
      // Reset game state when last player disconnects to ensure clean state for next player
      this.resetGameState();
      logger.debug('🧹 Reset game state due to no players');
    } else if (humanPlayerCount > 0 && this.isPaused) {
      this.isPaused = false;
      logger.info('▶️ Game resumed - human players are back online');
      // Bots were cleared by resetGameState() while paused. Recreate them so
      // there are always opponents whenever a human is actively playing.
      if (this.entityManager.getBotCount() === 0) {
        const bots = this.createBots(3);
        if (bots) {
          logger.info(`🤖 Recreated ${bots.length} bots on resume`);
        }
      }
    }
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }

  /** Read-only snapshot for health checks and integration test barriers. */
  public getDiagnostics(): {
    isPaused: boolean;
    gameTime: number;
    humanPlayers: number;
    bots: number;
    asteroids: number;
  } {
    return {
      isPaused: this.isPaused,
      gameTime: this.gameTime,
      humanPlayers: this.entityManager.getHumanPlayerCount(),
      bots: this.entityManager.getBotCount(),
      asteroids: this.asteroidManager.getAsteroidCount(),
    };
  }

  /**
   * Force the world back to the empty paused state used after the last human
   * disconnects. Intended for integration/E2E test harnesses only.
   */
  public resetForTesting(): void {
    for (const entity of this.entityManager.getAllEntities()) {
      if (entity.type === 'human' && entity.ws) {
        try {
          entity.ws.close(1000, 'Test world reset');
        } catch {
          // Socket may already be closed.
        }
      }
    }
    this.resetGameState();
    this.isPaused = true;
    this.rngService.reset();
  }

  // Reset game state when no players are online
  private resetGameState(): void {
    // Clear all asteroids
    this.asteroidManager.clearAsteroids();
    
    // Clear all entities (bots, players, etc.)
    this.entityManager.clearAll();

    // Keep gameTime monotonic for the process lifetime. Zeroing it when the
    // last player leaves makes /health.world.gameTime look frozen on prod
    // between sessions; localhost stays connected so the tick appears fine.
    
    logger.debug('🧹 Game state reset - all entities and asteroids cleared');
  }

  // Entity operations
  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position, color?: string): GameEntity {
    const entity = this.entityManager.addHumanPlayer(id, name, ws, position, color);
    this.updatePauseState();
    return entity;
  }

  public removePlayer(id: string): GameEntity | undefined {
    const entity = this.entityManager.removeEntity(id);
    this.updatePauseState();
    return entity;
  }

  public updatePlayer(id: string, updates: Partial<GameEntity>): GameEntity | undefined {
    return this.entityManager.updateEntity(id, updates);
  }

  public getEntity(id: string): GameEntity | undefined {
    return this.entityManager.getEntity(id);
  }

  public getAllEntities(): GameEntity[] {
    return this.entityManager.getAllEntities();
  }

  public getPlayer(id: string): GameEntity | undefined {
    return this.entityManager.getEntity(id);
  }

  /**
   * Protocol gate for inbound `update` messages. Rejects death-pose writes
   * and releases the respawn anchor once the client echoes a nearby transform.
   */
  public acceptClientMovement(id: string, incomingPosition?: Position): boolean {
    const entity = this.entityManager.getEntity(id);
    if (!entity) {
      return false;
    }
    if (!shouldAcceptClientMovement(entity, incomingPosition)) {
      return false;
    }
    if (entity.respawnAnchor && incomingPosition) {
      entity.respawnAnchor = undefined;
    }
    return true;
  }

  public getAllPlayers(): GameEntity[] {
    return this.entityManager.getHumanPlayers();
  }

  public getPlayerCount(): number {
    return this.entityManager.getHumanPlayerCount();
  }

  // Asteroid operations
  public addAsteroid(asteroid: AsteroidData): void {
    this.asteroidManager.addAsteroid(asteroid);
  }

  public removeAsteroid(asteroidId: string): AsteroidData | undefined {
    return this.asteroidManager.removeAsteroid(asteroidId);
  }

  public updateAsteroid(asteroidId: string, updates: Partial<AsteroidData>): AsteroidData | undefined {
    return this.asteroidManager.updateAsteroid(asteroidId, updates);
  }

  public getAsteroid(asteroidId: string): AsteroidData | undefined {
    return this.asteroidManager.getAsteroid(asteroidId);
  }

  public getAllAsteroids(): AsteroidData[] {
    return this.asteroidManager.getAllAsteroids();
  }

  public getAsteroidCount(): number {
    return this.asteroidManager.getAsteroidCount();
  }

  public createAsteroids(count: number, bounds = { radius: ARENA_RADIUS }, botPositions: Array<{ x: number; y: number }> = [], playerPositions: Array<{ x: number; y: number }> = []): AsteroidData[] {
    return this.asteroidManager.createAsteroids(count, bounds, botPositions, playerPositions);
  }

  // Bot operations
  public createBots(count: number): GameEntity[] | null {
    return this.entityManager.createBotsSafely(count);
  }

  public getBot(botId: string): GameEntity | undefined {
    return this.entityManager.getEntity(botId);
  }

  public getAllBots(): GameEntity[] {
    return this.entityManager.getBots();
  }

  public getBotCount(): number {
    return this.entityManager.getBotCount();
  }

  public updateBot(botId: string, updates: Partial<GameEntity>): GameEntity | undefined {
    return this.entityManager.updateEntity(botId, updates);
  }

  public removeBot(botId: string): GameEntity | undefined {
    return this.entityManager.removeEntity(botId);
  }

  public handlePlayerDamage(targetPlayerId: string, attackerId: string, damage: number): boolean {
    return this.applyCombatDamage(targetPlayerId, attackerId, damage, {
      kind: 'human',
      killPoints: COMBAT_REWARDS.playerKill,
      decrementLives: true,
      scheduleRespawnOnKill: true,
      requireValidAttacker: true,
    });
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    return this.applyCombatDamage(botId, attackerId, damage, {
      kind: 'bot',
      killPoints: COMBAT_REWARDS.botKill,
      decrementLives: false,
      scheduleRespawnOnKill: false,
      requireValidAttacker: false,
    });
  }

  public handleTargetDamage(targetId: string, attackerId: string, damage: number): boolean {
    const target = this.entityManager.getEntity(targetId);
    if (!target) {
      return false;
    }
    return target.type === 'bot'
      ? this.handleBotDamage(targetId, attackerId, damage)
      : this.handlePlayerDamage(targetId, attackerId, damage);
  }

  private applyCombatDamage(
    targetId: string,
    attackerId: string,
    damage: number,
    rules: {
      kind: 'human' | 'bot';
      killPoints: number;
      decrementLives: boolean;
      scheduleRespawnOnKill: boolean;
      requireValidAttacker: boolean;
    }
  ): boolean {
    const existing = this.entityManager.getEntity(targetId);
    if (!existing || existing.type !== rules.kind) {
      return false;
    }

    const damaged = this.entityManager.damageEntity(targetId, damage);
    if (!damaged) {
      return false;
    }
    if (damaged.health > 0) {
      return false;
    }

    if (rules.decrementLives) {
      const prevLives = damaged.lives;
      damaged.lives = Math.max(0, damaged.lives - 1);
      logger.info('PLAYER', `Life lost`, {
        playerId: targetId,
        name: damaged.name,
        livesBefore: prevLives,
        livesAfter: damaged.lives,
      });
    }

    const attackerIsValid =
      !!attackerId && attackerId !== targetId && !!this.entityManager.getEntity(attackerId);
    if (!rules.requireValidAttacker || attackerIsValid) {
      this.awardPoints(attackerId, rules.killPoints);
    }

    if (rules.scheduleRespawnOnKill && damaged.lives > 0) {
      this.entityManager.updateEntity(targetId, {
        respawnTimer: LIFECYCLE.respawnFrames,
      });
    }

    return true;
  }

  public handleAsteroidDestruction(asteroidId: string, playerId: string, points: number): { success: boolean; newAsteroids: any[] } {
    // Use the new destroyAsteroid method that handles splitting
    const result = this.asteroidManager.destroyAsteroid(asteroidId);
    if (!result.destroyed) {
      return { success: false, newAsteroids: [] };
    }

    // Award points to the player
    this.awardPoints(playerId, points);

    // Return success status and any new asteroids created from splitting
    return { 
      success: true, 
      newAsteroids: result.newAsteroids 
    };
  }

  public getGameState(): ServerGameState {
    const allEntities = this.entityManager.getAllEntities();
    const gameState: ServerGameState = {
      entities: allEntities.map((entity) => snapshotEntity(entity)),
      asteroids: this.asteroidManager.getAllAsteroids().map(snapshotAsteroid),
      gameTime: this.gameTime,
      isPaused: this.isPaused,
    };

    const humanPlayers = allEntities.filter((entity) => entity.type === 'human');
    if (humanPlayers.length > 0) {
      logger.debug('GAME_STATE', 'Sending game state with health values', {
        players: humanPlayers.map((player) => ({
          id: player.id,
          name: player.name,
          health: player.health,
          maxHealth: player.maxHealth,
          exploding: player.exploding,
          respawnTimer: player.respawnTimer,
        })),
      });
    }

    return gameState;
  }

  // Award points to an entity
  private awardPoints(entityId: string, points: number): void {
    const entity = this.entityManager.getEntity(entityId);
    if (entity) {
      entity.score += points;
      entity.lastUpdate = Date.now();
    }
  }

  // Bot-specific update methods for testing
  // Health regeneration is now handled client-side

  public updateBotMovement(): void {
    this.entityManager.updateBotMovement();
  }


  // Validation
  public validatePosition(position: any): { x: number; y: number } | null {
    if (!position || typeof position !== 'object') {
      return null;
    }

    const x = typeof position.x === 'number' ? position.x : (typeof position.x === 'string' ? parseFloat(position.x) : NaN);
    const y = typeof position.y === 'number' ? position.y : (typeof position.y === 'string' ? parseFloat(position.y) : NaN);

    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      return null;
    }

    return { x, y };
  }
}
