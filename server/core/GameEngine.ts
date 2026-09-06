import { WebSocket } from 'ws';
import type { Position, Velocity, AsteroidData } from '../../shared-types';
import { EntityManager, GameEntity } from './EntityManager';
import { AsteroidManager } from './AsteroidManager.ts';
import { RNGService } from './RNGService';
import { CANVAS, LASER, SHIP } from '../../src/constants';
import {
  asteroidPointsForRadius,
  checkLaserAsteroidCollisionSwept,
  isLaserNearAsteroid,
} from '../../src/physics/collision/collisionDetection';
import { getVelocityMagnitude } from '../../src/utils/mathUtils';
import { logger } from '../../setup/serverLogger';

export interface ServerLaser {
  id: string;
  ownerId: string;
  position: Position;
  prevPosition: Position;
  velocity: Velocity;
  distTraveled: number;
  hasExploded: boolean;
}

export interface AppliedAsteroidHit {
  applied: boolean;
  asteroidId: string;
  playerId: string;
  points: number;
  newAsteroids: AsteroidData[];
}

/** Matches client Laser.isExpired: TRAVEL_DISTANCE_RATIO + canvas width. */
const SERVER_LASER_MAX_DISTANCE = LASER.TRAVEL_DISTANCE_RATIO + CANVAS.INTERNAL_WIDTH;

export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players
  private lasers: ServerLaser[] = [];
  private laserSeq = 0;
  private onAsteroidHits?: (hits: AppliedAsteroidHit[]) => void;
  private pendingAsteroidHits: AppliedAsteroidHit[] = [];

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
      
      // Only update game state if not paused
      if (!this.isPaused) {
        this.entityManager.cleanupStaleEntities();
        this.entityManager.updateExplosions();
        this.entityManager.updateRespawns();
        this.asteroidManager.moveAsteroids();
        this.emitAsteroidHits(this.advanceLasersAndResolveHits());
        
        // Update bot movement at reduced frequency for better performance
        // Update every 2 frames (30 FPS instead of 60 FPS)
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
    this.lasers = [];
    this.laserSeq = 0;
    this.pendingAsteroidHits = [];
    
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
  public handlePlayerDamage(targetPlayerId: string, attackerId: string, damage: number): boolean {
    console.log('DEBUG: handlePlayerDamage called', { targetPlayerId, attackerId, damage });
    // Ignore damage if player is already in respawn countdown or already at 0 health
    const existing = this.getPlayer(targetPlayerId);
    if (!existing) {
      console.log('DEBUG: damagedPlayer is null');
      return false;
    }
    if (existing.respawnTimer !== undefined || existing.health <= 0) {
      console.log('DEBUG: ignoring damage during respawn or while dead');
      return false;
    }

    const damagedPlayer = this.entityManager.damageEntity(targetPlayerId, damage);
    if (!damagedPlayer) {
      console.log('DEBUG: damagedPlayer is null');
      return false;
    }
    console.log('DEBUG: damagedPlayer after damage', { health: damagedPlayer.health, exploding: damagedPlayer.exploding });

    // Handle destruction: decrement lives, award points, and schedule respawn if any lives remain
    if (damagedPlayer.health <= 0) {
      // Decrement lives for the destroyed player (min 0)
      const destroyedEntity = this.entityManager.getEntity(targetPlayerId);
      if (destroyedEntity) {
        const prevLives = destroyedEntity.lives;
        destroyedEntity.lives = Math.max(0, destroyedEntity.lives - 1);
        logger.info('PLAYER', `Life lost`, {
          playerId: targetPlayerId,
          name: destroyedEntity.name,
          livesBefore: prevLives,
          livesAfter: destroyedEntity.lives,
        });
      }

      // Only award points if attacker is a valid, different player
      const attackerIsValidPlayer = !!attackerId && attackerId !== targetPlayerId && !!this.entityManager.getEntity(attackerId);
      if (attackerIsValidPlayer) {
        this.awardPoints(attackerId, 200);
      }

      // Schedule respawn only if player still has lives remaining
      if (destroyedEntity && destroyedEntity.lives > 0) {
        this.entityManager.updateEntity(targetPlayerId, {
          respawnTimer: SHIP.RESPAWN_DELAY_FRAMES,
        });
      }

      return true; // Player was destroyed
    }

    return false;
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    const existing = this.getBot(botId);
    if (!existing || existing.respawnTimer !== undefined || existing.health <= 0 || existing.exploding) {
      return false;
    }

    const damagedBot = this.entityManager.damageEntity(botId, damage);
    if (!damagedBot) {
      return false;
    }

    // Award points to attacker for destroying a bot
    if (damagedBot.health <= 0) {
      this.awardPoints(attackerId, 50);
      return true; // Bot was destroyed
    }

    return false; // Bot was damaged but not destroyed
  }

  /**
   * Sole path that breaks a roid. Second call for the same id is a no-op so
   * two tabs (or a client hint plus the server laser tick) cannot double-split
   * or double-score.
   */
  public applyLaserAsteroidHit(
    asteroidId: string,
    playerId: string,
    laserPosition?: Position
  ): AppliedAsteroidHit {
    const empty: AppliedAsteroidHit = {
      applied: false,
      asteroidId,
      playerId,
      points: 0,
      newAsteroids: [],
    };

    const asteroid = this.asteroidManager.getAsteroid(asteroidId);
    if (!asteroid) {
      return empty;
    }

    if (laserPosition && !isLaserNearAsteroid(laserPosition, asteroid.position, asteroid.size)) {
      return empty;
    }

    const points = asteroidPointsForRadius(asteroid.size);
    const result = this.asteroidManager.destroyAsteroid(asteroidId);
    if (!result.destroyed) {
      return empty;
    }

    this.awardPoints(playerId, points);
    this.consumeOwnerLaserNear(playerId, result.destroyed.position);
    return {
      applied: true,
      asteroidId,
      playerId,
      points,
      newAsteroids: result.newAsteroids,
    };
  }

  public handleAsteroidDestruction(asteroidId: string, playerId: string, _points?: number): { success: boolean; newAsteroids: AsteroidData[] } {
    const result = this.applyLaserAsteroidHit(asteroidId, playerId);
    return {
      success: result.applied,
      newAsteroids: result.newAsteroids,
    };
  }

  public setOnAsteroidHits(listener: (hits: AppliedAsteroidHit[]) => void): void {
    this.onAsteroidHits = listener;
    if (this.pendingAsteroidHits.length > 0) {
      listener(this.pendingAsteroidHits.splice(0));
    }
  }

  public spawnPlayerLaser(ownerId: string, start: Position, velocity: Velocity): ServerLaser | null {
    const position = this.validatePosition(start);
    const vx = typeof velocity?.x === 'number' && Number.isFinite(velocity.x) ? velocity.x : NaN;
    const vy = typeof velocity?.y === 'number' && Number.isFinite(velocity.y) ? velocity.y : NaN;
    if (!position || !Number.isFinite(vx) || !Number.isFinite(vy)) {
      return null;
    }

    this.laserSeq += 1;
    const laser: ServerLaser = {
      id: `server-laser-${ownerId}-${this.laserSeq}`,
      ownerId,
      position: { x: position.x, y: position.y },
      prevPosition: { x: position.x, y: position.y },
      velocity: { x: vx, y: vy },
      distTraveled: 0,
      hasExploded: false,
    };
    this.lasers.push(laser);
    return laser;
  }

  public getServerLasers(): readonly ServerLaser[] {
    return this.lasers;
  }

  /** Move live lasers and apply at most one break per asteroid / laser. */
  public advanceLasersAndResolveHits(): AppliedAsteroidHit[] {
    const hits: AppliedAsteroidHit[] = [];

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (laser === undefined) {
        continue;
      }
      if (laser.hasExploded) {
        this.lasers.splice(i, 1);
        continue;
      }

      laser.prevPosition = { x: laser.position.x, y: laser.position.y };
      laser.position = {
        x: laser.position.x + laser.velocity.x,
        y: laser.position.y + laser.velocity.y,
      };
      laser.distTraveled += getVelocityMagnitude(laser.velocity);

      if (laser.distTraveled >= SERVER_LASER_MAX_DISTANCE) {
        this.lasers.splice(i, 1);
        continue;
      }

      const hit = this.resolveLaserAgainstAsteroids(laser);
      if (hit) {
        hits.push(hit);
        this.lasers.splice(i, 1);
      }
    }

    return hits;
  }

  /** Immediate overlap check used when a shot is spawned on top of a roid. */
  public resolveSpawnedLaserHits(): AppliedAsteroidHit[] {
    const hits: AppliedAsteroidHit[] = [];
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (laser === undefined || laser.hasExploded) {
        continue;
      }
      const hit = this.resolveLaserAgainstAsteroids(laser);
      if (hit) {
        hits.push(hit);
        this.lasers.splice(i, 1);
      }
    }
    return hits;
  }

  private resolveLaserAgainstAsteroids(laser: ServerLaser): AppliedAsteroidHit | null {
    for (const asteroid of this.asteroidManager.getAllAsteroids()) {
      if (
        !checkLaserAsteroidCollisionSwept(
          laser.prevPosition,
          laser.position,
          asteroid.position,
          asteroid.size
        )
      ) {
        continue;
      }
      const hit = this.applyLaserAsteroidHit(asteroid.id, laser.ownerId);
      if (hit.applied) {
        laser.hasExploded = true;
        return hit;
      }
    }
    return null;
  }

  private consumeOwnerLaserNear(ownerId: string, asteroidPos: Position): void {
    for (const laser of this.lasers) {
      if (laser.hasExploded || laser.ownerId !== ownerId) {
        continue;
      }
      if (isLaserNearAsteroid(laser.position, asteroidPos, 0)) {
        laser.hasExploded = true;
        return;
      }
    }
  }

  private emitAsteroidHits(hits: AppliedAsteroidHit[]): void {
    const applied = hits.filter((hit) => hit.applied);
    if (applied.length === 0) {
      return;
    }
    if (this.onAsteroidHits) {
      this.onAsteroidHits(applied);
      return;
    }
    this.pendingAsteroidHits.push(...applied);
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
