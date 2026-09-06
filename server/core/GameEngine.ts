import { WebSocket } from 'ws';
import type { Position, AsteroidData } from '../../shared-types';
import {
  asteroidDestroyPoints,
  asteroidRamDamage,
  shipShipTickDamage,
} from '../../shared/combat';
import { EntityManager, GameEntity } from './EntityManager';
import { AsteroidManager } from './AsteroidManager.ts';
import { CollisionAuthority } from './CollisionAuthority';
import { RNGService } from './RNGService';
import { SHIP } from '../../src/constants';
import { logger } from '../../setup/serverLogger';

export interface CombatBroadcast {
  targetId: string;
  attackerId: string;
  damage: number;
  remainingHealth: number;
  remainingLives: number;
  isDestroyed: boolean;
  targetType: 'human' | 'bot';
  targetName: string;
  awardedScore?: { playerId: string; score: number };
  destroyedAsteroidId?: string;
  newAsteroids?: AsteroidData[];
  asteroidScore?: { playerId: string; score: number };
}

export type CombatSink = (result: CombatBroadcast) => void;

export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private rngService: RNGService;
  private collisionAuthority = new CollisionAuthority();
  private combatSink: CombatSink | null = null;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.entityManager = new EntityManager(this.rngService);
    this.asteroidManager = new AsteroidManager(this.rngService);

    // Don't initialize pause state yet - will be called after initialization
  }

  public setCombatSink(sink: CombatSink | null): void {
    this.combatSink = sink;
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
      
      // Only update game state if not paused
      if (!this.isPaused) {
        this.entityManager.cleanupStaleEntities();
        this.entityManager.updateExplosions();
        this.entityManager.updateRespawns();
        
        // Update bot movement at reduced frequency for better performance
        // Update every 2 frames (30 FPS instead of 60 FPS)
        if (this.gameTime % 2 === 0) {
          this.entityManager.updateBotMovement();
        }

        this.resolveAuthoritativeCombat();
      }
    }, 1000 / 60); // 60 FPS
  }

  public stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
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
    this.collisionAuthority.reset();

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

  public getPlayer(id: string): GameEntity | undefined {
    return this.entityManager.getEntity(id);
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

  public createAsteroids(count: number, bounds = { radius: 3100 }, botPositions: Array<{ x: number; y: number }> = [], playerPositions: Array<{ x: number; y: number }> = []): AsteroidData[] {
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

  // Game logic operations
  /**
   * Apply damage to a human or bot through one path. Health/lives stay
   * server-owned; kill scores still differ (200 human / 50 bot).
   */
  public handleShipDamage(
    targetId: string,
    attackerId: string,
    damage: number
  ): { applied: boolean; isDestroyed: boolean; entity?: GameEntity } {
    const existing = this.entityManager.getEntity(targetId);
    if (!existing) {
      return { applied: false, isDestroyed: false };
    }
    if (existing.respawnTimer !== undefined || existing.health <= 0 || existing.exploding) {
      return { applied: false, isDestroyed: false };
    }

    const damaged = this.entityManager.damageEntity(targetId, damage);
    if (!damaged) {
      return { applied: false, isDestroyed: false };
    }

    if (damaged.health > 0) {
      return { applied: true, isDestroyed: false, entity: damaged };
    }

    if (damaged.type === 'human') {
      const prevLives = damaged.lives;
      damaged.lives = Math.max(0, damaged.lives - 1);
      logger.info('PLAYER', `Life lost`, {
        playerId: targetId,
        name: damaged.name,
        livesBefore: prevLives,
        livesAfter: damaged.lives,
      });
      if (damaged.lives > 0) {
        this.entityManager.updateEntity(targetId, {
          respawnTimer: SHIP.RESPAWN_DELAY_FRAMES,
        });
      }
      const attackerIsValid =
        !!attackerId && attackerId !== targetId && !!this.entityManager.getEntity(attackerId);
      if (attackerIsValid) {
        this.awardPoints(attackerId, 200);
      }
    } else {
      this.awardPoints(attackerId, 50);
    }

    return { applied: true, isDestroyed: true, entity: damaged };
  }

  public handlePlayerDamage(targetPlayerId: string, attackerId: string, damage: number): boolean {
    if (!this.getPlayer(targetPlayerId)) {
      return false;
    }
    return this.handleShipDamage(targetPlayerId, attackerId, damage).isDestroyed;
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    if (!this.getBot(botId)) {
      return false;
    }
    return this.handleShipDamage(botId, attackerId, damage).isDestroyed;
  }

  /**
   * Server-owned ship↔asteroid and ship↔ship resolution. Humans and bots
   * share the same overlap + handleShipDamage path.
   */
  public resolveAuthoritativeCombat(now: number = Date.now()): CombatBroadcast[] {
    if (this.isPaused) {
      return [];
    }

    this.asteroidManager.advance();
    const results: CombatBroadcast[] = [];
    const entities = this.entityManager.getAllEntities();

    const ramHits = this.collisionAuthority.collectShipAsteroidHits(
      entities,
      this.asteroidManager.getAllAsteroids()
    );
    const destroyedAsteroids = new Set<string>();
    const ramDamage = asteroidRamDamage();
    for (const hit of ramHits) {
      const result = this.applyDirectedHit(hit.shipId, 'asteroid', ramDamage);
      if (!result) {
        continue;
      }
      if (!destroyedAsteroids.has(hit.asteroidId)) {
        destroyedAsteroids.add(hit.asteroidId);
        const destruction = this.handleAsteroidDestruction(
          hit.asteroidId,
          hit.shipId,
          asteroidDestroyPoints(this.getAsteroid(hit.asteroidId)?.size ?? 0)
        );
        if (destruction.success) {
          result.destroyedAsteroidId = hit.asteroidId;
          result.newAsteroids = destruction.newAsteroids;
          const scorer = this.entityManager.getEntity(hit.shipId);
          if (scorer) {
            result.asteroidScore = { playerId: hit.shipId, score: scorer.score };
          }
        }
      }
      results.push(result);
    }

    const pairTicks = this.collisionAuthority.collectShipShipTicks(entities, now);
    const tickDamage = shipShipTickDamage();
    for (const pair of pairTicks) {
      const first = this.applyDirectedHit(pair.a, pair.b, tickDamage);
      if (first) {
        results.push(first);
      }
      const second = this.applyDirectedHit(pair.b, pair.a, tickDamage);
      if (second) {
        results.push(second);
      }
    }

    for (const result of results) {
      this.combatSink?.(result);
    }
    return results;
  }

  private applyDirectedHit(
    targetId: string,
    attackerId: string,
    damage: number
  ): CombatBroadcast | null {
    const outcome = this.handleShipDamage(targetId, attackerId, damage);
    if (!outcome.applied || !outcome.entity) {
      return null;
    }
    const broadcast: CombatBroadcast = {
      targetId,
      attackerId,
      damage,
      remainingHealth: outcome.entity.health,
      remainingLives: outcome.entity.lives,
      isDestroyed: outcome.isDestroyed,
      targetType: outcome.entity.type,
      targetName: outcome.entity.name,
    };
    if (outcome.isDestroyed) {
      const attacker = this.entityManager.getEntity(attackerId);
      if (attacker) {
        broadcast.awardedScore = { playerId: attackerId, score: attacker.score };
      }
    }
    return broadcast;
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

  // Game state
  public getGameState() {
    const allEntities = this.entityManager.getAllEntities();
    const gameState = {
      entities: allEntities.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        position: entity.position,
        velocity: entity.velocity,
        angle: entity.angle,
        exploding: entity.exploding,
        thrusting: entity.thrusting,
        color: entity.color,
        lives: entity.lives,
        score: entity.score,
        health: entity.health,
        maxHealth: entity.maxHealth,
        respawnTimer: entity.respawnTimer,
        spawnProtectionTimer: entity.spawnProtectionTimer,
      })),
      asteroids: this.asteroidManager.getAllAsteroids(),
      gameTime: this.gameTime,
      isPaused: this.isPaused,
    };
    
    // Debug logging for health values
    const humanPlayers = allEntities.filter(e => e.type === 'human');
    if (humanPlayers.length > 0) {
      logger.debug('GAME_STATE', 'Sending game state with health values', {
        players: humanPlayers.map(p => ({
          id: p.id,
          name: p.name,
          health: p.health,
          maxHealth: p.maxHealth,
          exploding: p.exploding,
          respawnTimer: p.respawnTimer
        }))
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
