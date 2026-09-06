import { WebSocket } from 'ws';
import type { AsteroidData, Position, ShipKitId, SoftFactionId } from '../../shared-types';
import { consumeTickAccumulator, GAME_TICK_MS } from '../../shared/gameClock';
import { canDealCombatDamage } from '../../src/entities/player/softFactions';
import { activateAbilityOnHost, pullHarpoonTarget } from '../../src/entities/ship/shipAbilities';
import { EntityManager, GameEntity } from './EntityManager';
import { AsteroidManager } from './AsteroidManager.ts';
import { RNGService } from './RNGService';
import { getAsteroidFieldRadius } from '../../src/physics/asteroidMotion';
import { logger } from '../../setup/serverLogger';

export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players
  private lastTickAtMs = 0;
  private tickAccumulatorMs = 0;
  private clockPrimed = false;

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

    this.lastTickAtMs = Date.now();
    this.tickAccumulatorMs = 0;
    this.clockPrimed = true;
    this.gameLoopInterval = setInterval(() => {
      this.stepClock(Date.now());
    }, GAME_TICK_MS);
  }

  /**
   * Advance the monotonic clock and catch up missed simulation frames.
   * A blocked event loop used to increment gameTime once per late interval
   * fire, which froze explode/respawn and made /health.world.gameTime look stuck.
   */
  public stepClock(nowMs: number): number {
    if (!this.clockPrimed) {
      this.lastTickAtMs = nowMs;
      this.clockPrimed = true;
      return 0;
    }
    const elapsed = nowMs - this.lastTickAtMs;
    this.lastTickAtMs = nowMs;
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      return 0;
    }
    this.tickAccumulatorMs += elapsed;
    const { frames, remainingMs } = consumeTickAccumulator(this.tickAccumulatorMs);
    this.tickAccumulatorMs = remainingMs;
    for (let i = 0; i < frames; i++) {
      this.advanceOneFrame();
    }
    return frames;
  }

  /** One 60 Hz frame: clock always ticks; combat/field only while a human is in. */
  public advanceOneFrame(): void {
    this.gameTime++;
    if (this.isPaused) {
      return;
    }
    this.entityManager.cleanupStaleEntities();
    this.entityManager.updateExplosions();
    this.entityManager.updateRespawns();
    this.tickAbilities();
    this.asteroidManager.updateMotion();
    if (this.gameTime % 2 === 0) {
      this.entityManager.updateBotMovement();
    }
  }

  /** Combat pair + clock — scenario tests drive death→respawn without moving the belt. */
  public advanceCombatFrame(): void {
    this.gameTime++;
    if (this.isPaused) {
      return;
    }
    this.entityManager.updateExplosions();
    this.entityManager.updateRespawns();
    this.tickAbilities();
  }

  public stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    this.lastTickAtMs = 0;
    this.tickAccumulatorMs = 0;
    this.clockPrimed = false;
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
  public addPlayer(
    id: string,
    name: string,
    ws: WebSocket,
    position?: Position,
    color?: string,
    kitId?: ShipKitId,
    factionId?: SoftFactionId
  ): GameEntity {
    const entity = this.entityManager.addHumanPlayer(id, name, ws, position, color, kitId, factionId);
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

  public createAsteroids(
    count: number,
    bounds = { radius: getAsteroidFieldRadius() },
    botPositions: Array<{ x: number; y: number }> = [],
    playerPositions: Array<{ x: number; y: number }> = []
  ): AsteroidData[] {
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
    logger.debug('handlePlayerDamage called', { targetPlayerId, attackerId, damage });
    // Ignore damage if player is already in respawn countdown or already at 0 health
    const existing = this.getPlayer(targetPlayerId);
    if (!existing) {
      logger.debug('damagedPlayer is null');
      return false;
    }
    if (existing.respawnTimer !== undefined || existing.health <= 0) {
      logger.debug('ignoring damage during respawn or while dead');
      return false;
    }
    if (!this.combatSidesAllowDamage(attackerId, targetPlayerId)) {
      return false;
    }

    const damagedPlayer = this.entityManager.damageEntity(targetPlayerId, damage);
    if (!damagedPlayer) {
      logger.debug('damagedPlayer is null after damageEntity');
      return false;
    }
    logger.debug('damagedPlayer after damage', {
      health: damagedPlayer.health,
      exploding: damagedPlayer.exploding,
    });

    if (damagedPlayer.health <= 0) {
      const destroyedEntity = this.entityManager.getEntity(targetPlayerId);
      if (destroyedEntity) {
        this.applyShipDeath(destroyedEntity, attackerId, 200);
      }
      return true;
    }

    return false;
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    const existing = this.getBot(botId);
    if (!existing || existing.respawnTimer !== undefined || existing.health <= 0 || existing.exploding) {
      return false;
    }
    if (!this.combatSidesAllowDamage(attackerId, botId)) {
      return false;
    }

    const damagedBot = this.entityManager.damageEntity(botId, damage);
    if (!damagedBot) {
      return false;
    }

    if (damagedBot.health <= 0) {
      this.applyShipDeath(damagedBot, attackerId, 50);
      return true;
    }

    return false;
  }

  /** One death path for humans and bots: lives (humans), points, shared respawn schedule. */
  private applyShipDeath(entity: GameEntity, attackerId: string, killPoints: number): void {
    if (entity.type === 'human') {
      const prevLives = entity.lives;
      entity.lives = Math.max(0, entity.lives - 1);
      logger.info('PLAYER', `Life lost`, {
        playerId: entity.id,
        name: entity.name,
        livesBefore: prevLives,
        livesAfter: entity.lives,
      });
      const attackerIsValidPlayer =
        !!attackerId && attackerId !== entity.id && !!this.entityManager.getEntity(attackerId);
      if (attackerIsValidPlayer) {
        this.awardPoints(attackerId, killPoints);
      }
    } else if (attackerId) {
      this.awardPoints(attackerId, killPoints);
    }
    this.entityManager.scheduleShipRespawn(entity);
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
        kitId: entity.kitId,
        factionId: entity.factionId,
        abilityCooldownFrames: entity.abilityCooldownFrames,
        abilityActiveFrames: entity.abilityActiveFrames,
        shieldTimer: entity.shieldTimer,
        harpoonTimer: entity.harpoonTimer,
        harpoonTargetId: entity.harpoonTargetId,
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

  private combatSidesAllowDamage(attackerId: string, targetId: string): boolean {
    if (!attackerId || attackerId === 'asteroid' || attackerId === 'boundary') {
      return true;
    }
    const attacker = this.entityManager.getEntity(attackerId);
    const target = this.entityManager.getEntity(targetId);
    return canDealCombatDamage(attacker?.factionId, target?.factionId);
  }

  public useAbility(entityId: string): boolean {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) {
      return false;
    }
    const world = {
      asteroids: this.asteroidManager.getAllAsteroids(),
      entities: this.entityManager.getAllEntities().filter((other) => other.id !== entityId),
    };
    return activateAbilityOnHost(entity, world).activated;
  }

  public tickAbilities(): void {
    this.entityManager.tickAbilityState();
    for (const entity of this.entityManager.getAllEntities()) {
      pullHarpoonTarget(entity, this.asteroidManager.getAllAsteroids());
    }
  }

  public handleAsteroidDamage(
    asteroidId: string,
    playerId: string,
    damage: number,
    points: number
  ): { destroyed: boolean; asteroid: AsteroidData | null; newAsteroids: AsteroidData[] } {
    const asteroid = this.asteroidManager.damageAsteroid(asteroidId, damage);
    if (!asteroid) {
      return { destroyed: false, asteroid: null, newAsteroids: [] };
    }
    if (asteroid.health > 0) {
      return { destroyed: false, asteroid, newAsteroids: [] };
    }
    const result = this.handleAsteroidDestruction(asteroidId, playerId, points);
    return { destroyed: result.success, asteroid, newAsteroids: result.newAsteroids };
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
