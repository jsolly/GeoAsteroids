import { WebSocket } from 'ws';
import type { Position, AsteroidData } from '../../shared-types';
import { PlayerManager, ConnectedPlayer } from './PlayerManager';
import { AsteroidManager } from './AsteroidManager.ts';
import { BotManager, ServerBot } from './BotManager';
import { RNGService } from './RNGService';
import { logger } from '../../setup/serverLogger';
import {
  GAME_FPS,
  calculateHealthRegenPerFrame,
  calculateHealthRegenDelayFrames,
  shouldStartHealthRegeneration,
  calculateHealthAfterHeal
} from '../../shared/constants/health';

export class GameEngine {
  private playerManager: PlayerManager;
  private asteroidManager: AsteroidManager;
  private botManager: BotManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isPaused = false; // Track if game is paused due to no players

  // Bot health regeneration state
  private botHealthRegenerationState: Map<string, {
    lastDamageTime: number;
    healthRegenTimer: number;
  }> = new Map();

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.playerManager = new PlayerManager();
    this.asteroidManager = new AsteroidManager(this.rngService);
    this.botManager = new BotManager(this.rngService);

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
        this.cleanupStalePlayers();
        this.updatePlayerHealthRegeneration();
        this.updateBotHealthRegeneration();
        this.updateBotExplosions();
        this.updatePlayerRespawns();
        this.updateBotMovement();
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
    const playerCount = this.playerManager.getPlayerCount();
    
    if (playerCount === 0 && !this.isPaused) {
      this.isPaused = true;
      logger.info('🔄 Game paused - no players online');
    } else if (playerCount > 0 && this.isPaused) {
      this.isPaused = false;
      logger.info('▶️ Game resumed - players are back online');
    }
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }

  // Player operations
  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position): ConnectedPlayer {
    const player = this.playerManager.addPlayer(id, name, ws, position);
    this.updatePauseState();
    return player;
  }

  public removePlayer(id: string): ConnectedPlayer | undefined {
    const player = this.playerManager.removePlayer(id);
    this.updatePauseState();
    return player;
  }

  public updatePlayer(id: string, updates: Partial<ConnectedPlayer>): ConnectedPlayer | undefined {
    return this.playerManager.updatePlayer(id, updates);
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this.playerManager.getPlayer(id);
  }

  public getAllPlayers(): ConnectedPlayer[] {
    return this.playerManager.getAllPlayers();
  }

  public getPlayerCount(): number {
    return this.playerManager.getPlayerCount();
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

  public createAsteroids(count: number): AsteroidData[] {
    return this.asteroidManager.createAsteroids(count);
  }

  // Bot operations
  public createBots(count: number): ServerBot[] | null {
    return this.botManager.createBotsSafely(count);
  }

  public getBot(botId: string): ServerBot | undefined {
    return this.botManager.getBot(botId);
  }

  public getAllBots(): ServerBot[] {
    return this.botManager.getAllBots();
  }

  public getBotCount(): number {
    return this.botManager.getBotCount();
  }

  public updateBot(botId: string, updates: Partial<ServerBot>): ServerBot | undefined {
    return this.botManager.updateBot(botId, updates);
  }

  public removeBot(botId: string): ServerBot | undefined {
    // Clean up health regeneration state
    this.botHealthRegenerationState.delete(botId);
    return this.botManager.removeBot(botId);
  }

  // Game logic operations
  public handlePlayerDamage(targetPlayerId: string, attackerId: string, damage: number): boolean {
    const damagedPlayer = this.playerManager.damagePlayer(targetPlayerId, damage);
    if (!damagedPlayer) {
      return false;
    }

    // Award points to attacker for destroying a player
    if ((damagedPlayer.health ?? 0) <= 0 && damagedPlayer.exploding) {
      // Only award points if attacker is a valid, different player
      const attackerIsValidPlayer = !!attackerId && attackerId !== targetPlayerId && !!this.playerManager.getPlayer(attackerId);
      if (attackerIsValidPlayer) {
        this.playerManager.awardPoints(attackerId, 200);
      }
      
      // Set respawn timer for the destroyed player
      const respawnDelay = 180; // 3 seconds at 60 FPS (explosion duration + message display)
      this.playerManager.updatePlayer(targetPlayerId, { respawnTimer: respawnDelay });
      
      return true; // Player was destroyed
    }

    return false;
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    const damagedBot = this.botManager.damageBot(botId, damage);
    if (!damagedBot) {
      return false;
    }

    // Initialize or reset health regeneration state for this bot
    this.botHealthRegenerationState.set(botId, {
                  lastDamageTime: GAME_FPS, // Reset damage cooldown
      healthRegenTimer: calculateHealthRegenDelayFrames() // Reset regen delay
    });

    // Award points to attacker for destroying a bot
    if (damagedBot.health <= 0 && damagedBot.exploding) {
      this.playerManager.awardPoints(attackerId, 50);
      // Clean up health regeneration state for destroyed bot
      this.botHealthRegenerationState.delete(botId);
      return true; // Bot was destroyed
    }

    return false;
  }

  public handleAsteroidDestruction(asteroidId: string, playerId: string, points: number): { success: boolean; newAsteroids: any[] } {
    // Use the new destroyAsteroid method that handles splitting
    const result = this.asteroidManager.destroyAsteroid(asteroidId);
    if (!result.destroyed) {
      return { success: false, newAsteroids: [] };
    }

    // Award points to the player
    this.playerManager.awardPoints(playerId, points);

    // Return success status and any new asteroids created from splitting
    return { 
      success: true, 
      newAsteroids: result.newAsteroids 
    };
  }

  // Game state
  public getGameState() {
    return {
      players: this.playerManager.getAllPlayers().map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        velocity: player.velocity ?? { x: 0, y: 0 },
        rotation: player.rotation ?? 0,
        angularVelocity: player.angularVelocity ?? 0,
        lives: player.lives ?? 3,
        score: player.score,
        exploding: player.exploding ?? false,
        health: player.health ?? 100,
        maxHealth: player.maxHealth ?? 100,
        respawnTimer: player.respawnTimer,
      })),
      bots: this.botManager.getAllBots().map(bot => ({
        id: bot.id,
        name: bot.name,
        position: bot.position,
        velocity: bot.velocity,
        angle: bot.angle,
        exploding: bot.exploding,
        lives: bot.lives,
        health: bot.health,
        maxHealth: bot.maxHealth,
      })),
      asteroids: this.asteroidManager.getAllAsteroids(),
      gameTime: this.gameTime,
      isPaused: this.isPaused,
    };
  }

  // Player health regeneration
  private updatePlayerHealthRegeneration(): void {
    this.playerManager.updatePlayerHealthRegeneration();
  }

  // Bot health regeneration
  private updateBotHealthRegeneration(): void {
    const bots = this.botManager.getAllBots();

    for (const bot of bots) {
      if (bot.exploding || bot.health <= 0) {
        continue; // Skip exploding or dead bots
      }

      // Get or initialize health regeneration state for this bot
      let regenState = this.botHealthRegenerationState.get(bot.id);
      if (!regenState) {
        // Initialize state for bots that haven't been damaged yet
        regenState = {
          lastDamageTime: 0,
          healthRegenTimer: 0
        };
        this.botHealthRegenerationState.set(bot.id, regenState);
      }

      // Update damage cooldown timer (increment elapsed time)
      if (regenState.lastDamageTime >= 0) {
        regenState.lastDamageTime++;
      }

      // Check if health regeneration should start
      if (shouldStartHealthRegeneration(regenState.lastDamageTime, bot.health, bot.maxHealth)) {
        // Regenerate health
        const regenAmount = calculateHealthRegenPerFrame();
        const newHealth = calculateHealthAfterHeal(bot.health, regenAmount, bot.maxHealth);

        if (newHealth > bot.health) {
          // Update bot health in the manager
          this.botManager.updateBot(bot.id, { health: newHealth });
        }
      }
    }
  }

  // Bot explosion updates
  private updateBotExplosions(): void {
    const finishedExploding = this.botManager.updateExplosions();
    
    // Remove bots that finished exploding
    for (const botId of finishedExploding) {
      this.botManager.removeBot(botId);
    }
  }

  // Player respawn updates
  private updatePlayerRespawns(): void {
    this.playerManager.updatePlayerRespawns();
  }

  // Bot movement updates
  private updateBotMovement(): void {
    this.botManager.updateBotMovement();
  }

  // Cleanup
  private cleanupStalePlayers(): string[] {
    return this.playerManager.cleanupStalePlayers();
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
