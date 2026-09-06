import { WebSocket } from 'ws';
import type { Position, AsteroidData, SatelliteData, SatelliteShoot } from '../../shared-types';
import { SATELLITE, SHIP } from '../../src/constants';
import { EntityManager, GameEntity } from './EntityManager';
import { AsteroidManager } from './AsteroidManager.ts';
import { SatelliteManager } from './SatelliteManager';
import { RNGService } from './RNGService';
import { logger } from '../../setup/serverLogger';

export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private satelliteManager: SatelliteManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players
  private pendingSatelliteShots: SatelliteShoot[] = [];

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.entityManager = new EntityManager(this.rngService);
    this.asteroidManager = new AsteroidManager(this.rngService);
    this.satelliteManager = new SatelliteManager(this.rngService);

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
        
        // Update bot movement at reduced frequency for better performance
        // Update every 2 frames (30 FPS instead of 60 FPS)
        if (this.gameTime % 2 === 0) {
          this.entityManager.updateBotMovement();
        }

        const targets = this.entityManager.getAllEntities().map((entity) => ({
          id: entity.id,
          position: entity.position,
          health: entity.health,
          exploding: entity.exploding,
        }));
        const shots = this.satelliteManager.update(targets);
        if (shots.length > 0) {
          this.pendingSatelliteShots.push(...shots);
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
      if (this.satelliteManager.getCount() === 0) {
        const satellites = this.createSatellites(2);
        if (satellites) {
          logger.info(`🛰️ Recreated ${satellites.length} satellites on resume`);
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
    satellites: number;
  } {
    return {
      isPaused: this.isPaused,
      gameTime: this.gameTime,
      humanPlayers: this.entityManager.getHumanPlayerCount(),
      bots: this.entityManager.getBotCount(),
      asteroids: this.asteroidManager.getAsteroidCount(),
      satellites: this.satelliteManager.getCount(),
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
    this.satelliteManager.clearSatellites();
    this.pendingSatelliteShots = [];
    
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

  public createSatellites(count: number): SatelliteData[] | null {
    return this.satelliteManager.createSatellitesSafely(count);
  }

  public getSatellite(satelliteId: string) {
    return this.satelliteManager.getSatellite(satelliteId);
  }

  public getAllSatellites(): SatelliteData[] {
    return this.satelliteManager.getAllSatellites();
  }

  public getSatelliteCount(): number {
    return this.satelliteManager.getCount();
  }

  public drainSatelliteShots(): SatelliteShoot[] {
    const shots = this.pendingSatelliteShots;
    this.pendingSatelliteShots = [];
    return shots;
  }

  public handleSatelliteDamage(satelliteId: string, attackerId: string, damage: number): boolean {
    const damaged = this.satelliteManager.damageSatellite(satelliteId, damage);
    if (!damaged) {
      return false;
    }
    if (damaged.health <= 0) {
      this.awardPoints(attackerId, SATELLITE.POINTS);
      return true;
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
      satellites: this.satelliteManager.getAllSatellites(),
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

  public tickSatellites(): SatelliteShoot[] {
    const targets = this.entityManager.getAllEntities().map((entity) => ({
      id: entity.id,
      position: entity.position,
      health: entity.health,
      exploding: entity.exploding,
    }));
    const shots = this.satelliteManager.update(targets);
    if (shots.length > 0) {
      this.pendingSatelliteShots.push(...shots);
    }
    return shots;
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
