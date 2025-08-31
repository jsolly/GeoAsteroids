import { WebSocket } from 'ws';
import type { Position, AsteroidData } from '../../shared-types';
import { PlayerManager, ConnectedPlayer } from './PlayerManager';
import { AsteroidManager } from './AsteroidManager';
import { BotManager, ServerBot } from './BotManager';
import { RNGService } from './RNGService';

export class GameEngine {
  private playerManager: PlayerManager;
  private asteroidManager: AsteroidManager;
  private botManager: BotManager;
  private rngService: RNGService;
  private gameTime = 0;
  private gameLoopInterval: NodeJS.Timeout | null = null;

  constructor(rngSeed?: number) {
    this.rngService = new RNGService(rngSeed);
    this.playerManager = new PlayerManager();
    this.asteroidManager = new AsteroidManager(this.rngService);
    this.botManager = new BotManager(this.rngService);
  }

  // Game loop management
  public startGameLoop(): void {
    if (this.gameLoopInterval) {
      return; // Already running
    }

    // Start game loop for cleanup (10 FPS)
    this.gameLoopInterval = setInterval(() => {
      this.gameTime++;
      this.cleanupStalePlayers();
    }, 100);
  }

  public stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  // Player operations
  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position): ConnectedPlayer {
    return this.playerManager.addPlayer(id, name, ws, position);
  }

  public removePlayer(id: string): ConnectedPlayer | undefined {
    return this.playerManager.removePlayer(id);
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
      this.playerManager.awardPoints(attackerId, 200);
      return true; // Player was destroyed
    }

    return false;
  }

  public handleBotDamage(botId: string, attackerId: string, damage: number): boolean {
    const damagedBot = this.botManager.damageBot(botId, damage);
    if (!damagedBot) {
      return false;
    }

    // Award points to attacker for destroying a bot
    if (damagedBot.health <= 0 && damagedBot.exploding) {
      this.playerManager.awardPoints(attackerId, 50);
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
      })),
      asteroids: this.asteroidManager.getAllAsteroids(),
      gameTime: this.gameTime,
    };
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
