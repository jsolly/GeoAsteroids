import { WebSocket } from 'ws';
import type { AsteroidData, LootData, Position, ShipKitId, SoftFactionId } from '../../shared-types';
import { consumeTickAccumulator, GAME_TICK_MS } from '../../shared/gameClock';
import { GROWTH, applyLootMass, applyShipMass } from '../../shared/shipGrowth';
import { canDealCombatDamage } from '../../src/entities/player/softFactions';
import { pointsForRoidSize } from '../../src/entities/roid/roidScore';
import { activateAbilityOnHost, pullHarpoonTarget } from '../../src/entities/ship/shipAbilities';
import { applyShipKitStats, isShipKitId } from '../../src/entities/ship/shipKits';
import {
  requestShield,
  resolveCombatDamageSource,
  shieldSnapshot,
  type CombatDamageSource,
} from '../../src/entities/ship/shipShield';
import { getAsteroidFieldRadius } from '../../src/physics/asteroidMotion';
import { TERRAIN } from '../../src/physics/terrain/terrainConfig';
import { ensureTerrain, getTerrainSeed } from '../../src/physics/terrain/terrainSession';
import { logger } from '../../setup/serverLogger';
import {
  AsteroidManager,
  type AsteroidHitCause,
  type AsteroidHitOutcome,
  type ExpiredCollabHit,
} from './AsteroidManager.ts';
import { EntityManager, GameEntity } from './EntityManager';
import { LootManager } from './LootManager';
import { RNGService } from './RNGService';

export class GameEngine {
  public entityManager: EntityManager;
  private asteroidManager: AsteroidManager;
  private lootManager: LootManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players
  private lastTickAtMs = 0;
  private tickAccumulatorMs = 0;
  private clockPrimed = false;
  private resolvedCollabHits: ExpiredCollabHit[] = [];

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.entityManager = new EntityManager(this.rngService);
    this.asteroidManager = new AsteroidManager(this.rngService);
    this.lootManager = new LootManager(this.rngService);
    ensureTerrain(TERRAIN.DEFAULT_SEED);

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
    this.entityManager.updateShields();
    this.lootManager.expire(this.gameTime);
    this.collectLoot();
    this.asteroidManager.updateMotion();
    this.flushExpiredCollabHits();
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
    this.entityManager.updateShields();
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
    loot: number;
  } {
    return {
      isPaused: this.isPaused,
      gameTime: this.gameTime,
      humanPlayers: this.entityManager.getHumanPlayerCount(),
      bots: this.entityManager.getBotCount(),
      asteroids: this.asteroidManager.getAsteroidCount(),
      loot: this.lootManager.getCount(),
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
    // Clear all asteroids and pending collab resolutions
    this.asteroidManager.clearAsteroids();
    this.resolvedCollabHits = [];
    this.lootManager.clear();
    
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

  public getPlayerBySocket(ws: WebSocket): GameEntity | undefined {
    return this.entityManager.getEntityBySocket(ws);
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

  // Game logic operations — humans and bots share the same friendly-fire gate.
  public requestShield(entityId: string, active: boolean): boolean {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity || entity.exploding || entity.health <= 0 || entity.respawnTimer !== undefined) {
      return false;
    }
    const changed = requestShield(entity, active, entity.exploding);
    if (changed) {
      entity.lastUpdate = Date.now();
    }
    return changed;
  }

  public handlePlayerDamage(
    targetPlayerId: string,
    attackerId: string,
    damage: number,
    source?: CombatDamageSource
  ): boolean {
    logger.debug('handlePlayerDamage called', { targetPlayerId, attackerId, damage, source });
    if (!this.combatSidesAllowDamage(attackerId, targetPlayerId)) {
      logger.debug('friendly fire ignored', { attackerId, targetPlayerId });
      return false;
    }
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

    const damagedPlayer = this.entityManager.damageEntity(
      targetPlayerId,
      damage,
      source ?? 'collision'
    );
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

  public handleBotDamage(
    botId: string,
    attackerId: string,
    damage: number,
    source?: CombatDamageSource
  ): boolean {
    if (!this.combatSidesAllowDamage(attackerId, botId)) {
      logger.debug('friendly fire ignored', { attackerId, botId });
      return false;
    }
    const existing = this.getBot(botId);
    if (!existing || existing.respawnTimer !== undefined || existing.health <= 0 || existing.exploding) {
      return false;
    }

    const damagedBot = this.entityManager.damageEntity(
      botId,
      damage,
      resolveCombatDamageSource(attackerId, source)
    );
    if (!damagedBot) {
      return false;
    }

    if (damagedBot.health <= 0) {
      this.applyShipDeath(damagedBot, attackerId, 50);
      return true;
    }

    return false;
  }

  /** One death path for humans and bots: loot, lives (humans), points, shared respawn. */
  private applyShipDeath(entity: GameEntity, attackerId: string, killPoints: number): void {
    if (attackerId) {
      entity.deathCause = attackerId;
    }
    this.lootManager.spawnFromKill(entity, this.gameTime);
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

  public handleAsteroidHit(
    asteroidId: string,
    playerId: string,
    cause: AsteroidHitCause = 'laser',
    now = Date.now()
  ): AsteroidHitOutcome {
    const result =
      cause === 'collision'
        ? this.asteroidManager.destroyFromCollision(asteroidId)
        : this.asteroidManager.registerLaserHit(asteroidId, playerId, now);

    if (result.outcome === 'destroyed' && result.destroyed) {
      this.awardPoints(playerId, pointsForRoidSize(result.destroyed.size));
    }

    return result;
  }

  public flushExpiredCollabHits(now = Date.now()): ExpiredCollabHit[] {
    const expired = this.asteroidManager.expireStaleHits(now);
    for (const item of expired) {
      this.awardPoints(item.playerId, item.points);
      this.resolvedCollabHits.push(item);
    }
    return expired;
  }

  public drainResolvedCollabHits(): ExpiredCollabHit[] {
    const items = this.resolvedCollabHits;
    this.resolvedCollabHits = [];
    return items;
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
        mass: entity.mass ?? GROWTH.BASE_MASS,
        respawnTimer: entity.respawnTimer,
        spawnProtectionTimer: entity.spawnProtectionTimer,
        kitId: entity.kitId,
        factionId: entity.factionId,
        abilityCooldownFrames: entity.abilityCooldownFrames,
        abilityActiveFrames: entity.abilityActiveFrames,
        shieldTimer: entity.shieldTimer,
        harpoonTimer: entity.harpoonTimer,
        harpoonTargetId: entity.harpoonTargetId,
        ...(entity.deathCause ? { deathCause: entity.deathCause } : {}),
        ...shieldSnapshot(entity),
      })),
      asteroids: this.asteroidManager.getAllAsteroids(),
      loot: this.lootManager.getAll(),
      gameTime: this.gameTime,
      isPaused: this.isPaused,
      terrainSeed: getTerrainSeed(),
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

  public useAbility(entityId: string, requestedKitId?: unknown): boolean {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) {
      return false;
    }
    if (isShipKitId(requestedKitId) && entity.kitId !== requestedKitId) {
      applyShipKitStats(entity, requestedKitId);
    }
    const world = {
      asteroids: this.asteroidManager.getAllAsteroids().map((asteroid) => ({
        ...asteroid,
        r: asteroid.size,
      })),
      entities: this.entityManager.getAllEntities().filter((other) => other.id !== entityId),
    };
    return activateAbilityOnHost(entity, world).activated;
  }

  public tickAbilities(): void {
    this.entityManager.tickAbilityState();
    const asteroids = this.asteroidManager.getAllAsteroids();
    const entities = this.entityManager.getAllEntities();
    for (const entity of entities) {
      pullHarpoonTarget(entity, [
        ...asteroids,
        ...entities.filter((other) => other.id !== entity.id),
      ]);
    }
  }

  public handleAsteroidDamage(
    asteroidId: string,
    playerId: string,
    damage: number,
    _points: number
  ): { destroyed: boolean; asteroid: AsteroidData | null; newAsteroids: AsteroidData[] } {
    const asteroid = this.asteroidManager.damageAsteroid(asteroidId, damage);
    if (!asteroid) {
      return { destroyed: false, asteroid: null, newAsteroids: [] };
    }
    if (asteroid.health > 0) {
      return { destroyed: false, asteroid, newAsteroids: [] };
    }
    // Chip-to-zero is kits coop HP, not the 1s split window.
    const result = this.asteroidManager.destroyFromCollision(asteroidId);
    if (result.destroyed) {
      this.awardPoints(playerId, pointsForRoidSize(result.destroyed.size));
    }
    return {
      destroyed: result.outcome === 'destroyed',
      asteroid,
      newAsteroids: result.newAsteroids,
    };
  }

  public getLoot(): LootData[] {
    return this.lootManager.getAll();
  }

  /** Server-authoritative pickup: first overlapping live ship wins. */
  public collectLoot(): Array<{ collectorId: string; lootId: string; mass: number }> {
    const collected = this.lootManager.collectOverlaps(this.entityManager.getAllEntities());
    const results: Array<{ collectorId: string; lootId: string; mass: number }> = [];
    for (const { collector, loot } of collected) {
      applyShipMass(collector, applyLootMass(collector.mass ?? GROWTH.BASE_MASS, loot.mass));
      collector.lastUpdate = Date.now();
      results.push({ collectorId: collector.id, lootId: loot.id, mass: collector.mass });
      logger.debug('LOOT', 'Collected kill loot', {
        collectorId: collector.id,
        lootId: loot.id,
        mass: collector.mass,
        maxHealth: collector.maxHealth,
      });
    }
    return results;
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

  public getTerrainSeed(): number {
    return getTerrainSeed();
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
