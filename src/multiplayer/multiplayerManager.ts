import type { Position, Velocity } from '../../shared-types';
import type { Player } from '../entities/player/Player';
import type { Roid, RoidBelt } from '../entities/roid/Roid';
import { logger } from '../utils/Logger';
import { AsteroidSyncManager } from './services/AsteroidSyncManager';
import { BotSyncManager } from './services/BotSyncManager';
import { ConnectionManager } from './services/ConnectionManager';
import { PlayerSyncManager } from './services/PlayerSyncManager';

/**
 * Simplified MultiplayerManager that orchestrates specialized services
 */
export class MultiplayerManager {
  private static instance: MultiplayerManager;

  private connectionManager: ConnectionManager;
  private playerSyncManager: PlayerSyncManager;
  private botSyncManager: BotSyncManager;
  private asteroidSyncManager: AsteroidSyncManager;

  private constructor() {
    this.connectionManager = ConnectionManager.getInstance();
    this.playerSyncManager = PlayerSyncManager.getInstance();
    this.botSyncManager = BotSyncManager.getInstance();
    this.asteroidSyncManager = AsteroidSyncManager.getInstance();

    this.setupConnectionHandlers();
  }

  static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  // Connection management
  async connect(): Promise<void> {
    await this.connectionManager.connect();
  }

  disconnect(): void {
    this.connectionManager.disconnect();
  }

  get isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  // Player management
  setLocalPlayerName(name: string): void {
    this.playerSyncManager.setLocalPlayerName(name);
  }

  getLocalPlayerName(): string {
    return this.playerSyncManager.getLocalPlayerName();
  }

  getLocalPlayerId(): string {
    return this.playerSyncManager.getLocalPlayerId();
  }

  getAllPlayers(): Player[] {
    return this.playerSyncManager.getAllPlayers();
  }

  getRemotePlayers(): Player[] {
    return this.playerSyncManager.getRemotePlayers();
  }

  getPlayer(playerId: string): Player | undefined {
    return this.playerSyncManager.getPlayer(playerId);
  }

  // Player state synchronization
  updatePlayerState(playerState: {
    position: Position;
    velocity: Velocity;
    r: number;
    angle: number;
    lives: number;
    score: number;
    exploding: boolean;
    health?: number;
    maxHealth?: number;
    lasers?: Array<{
      position: Position;
      velocity: Velocity;
      distTraveled: number;
      explodeTime: number;
      hasExploded: boolean;
    }>;
  }): void {
    this.playerSyncManager.updatePlayerState(playerState);
  }

  updateLocalPlayerForAllPlayers(position: Position, isAlive: boolean): void {
    this.botSyncManager.updateLocalPlayerForBots(position, isAlive);
  }

  // Bot management
  initializeBots(count: number): void {
    this.botSyncManager.initializeBots(count);
  }

  getBots(): Map<string, Player> {
    return this.botSyncManager.getBots();
  }

  updateBotsInGameLoop(): void {
    this.botSyncManager.updateBotsInGameLoop();
  }

  getBotPlayers(): Player[] {
    return this.botSyncManager.getBotPlayers();
  }

  // UI helper methods
  getServerName(): string {
    // Extract server name from websocket URL or return default
    // Compute fallback URL from current page location
    let computedUrl = 'ws://localhost:3001/ws'; // Default fallback

    if (typeof window !== 'undefined') {
      // Only use window.location if it has a valid host
      const host = window.location.host;
      if (host && host.trim() !== '' && window.location.protocol.startsWith('http')) {
        computedUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/ws`;
      }
    }

    const wsUrl = import.meta.env?.VITE_WEBSOCKET_URL || computedUrl;
    try {
      const url = new URL(wsUrl);
      if (url.hostname === 'localhost') {
        return `Local Server (${url.port})`;
      }
      return url.hostname;
    } catch {
      return 'Unknown Server';
    }
  }

  getConnectionStatus(): string {
    return this.isConnected ? 'connected' : 'disconnected';
  }

  // EMP destruction
  empDestroyPlayer(playerId: string): void {
    this.playerSyncManager.empDestroyPlayer(playerId);
  }

  empDestroyBot(botId: string): void {
    this.botSyncManager.empDestroyBot(botId);
  }

  // Shooting synchronization
  sendShootEvent(laserStart: Position, laserDirection: Velocity): void {
    this.playerSyncManager.sendShootEvent(laserStart, laserDirection);
  }

  // Bot damage synchronization
  laserDamagePlayer(playerId: string, damage: number): void {
    this.playerSyncManager.laserDamagePlayer(playerId, damage);
  }

  laserDamageBot(botId: string, damage: number): void {
    this.playerSyncManager.laserDamageBot(botId, damage);
  }

  // Asteroid destruction scoring
  asteroidDestroyed(asteroidId: string, points: number): void {
    this.playerSyncManager.asteroidDestroyed(asteroidId, points);
  }

  // Asteroid synchronization
  initializeAsteroidSync(): void {
    this.asteroidSyncManager.initialize();
  }

  setAsteroidBelt(roidBelt: RoidBelt): void {
    this.asteroidSyncManager.setAsteroidBelt(roidBelt);
  }

  syncAsteroidState(asteroid: Roid): void {
    this.asteroidSyncManager.syncAsteroidState(asteroid);
  }

  handleAsteroidDestruction(asteroidId: string): void {
    this.asteroidSyncManager.handleAsteroidDestruction(asteroidId);
  }

  private setupConnectionHandlers(): void {
    this.connectionManager.setConnectionHandlers({
      onConnect: () => {
        logger.debug('MULTIPLAYER', 'Connected to multiplayer server');
        this.playerSyncManager.joinGame();
      },
      onDisconnect: () => {
        logger.warn(
          'MULTIPLAYER',
          'Disconnected from multiplayer server - attempting reconnection'
        );

        // Don't immediately stop the game - try to reconnect first
        // This allows for temporary network hiccups without disrupting gameplay
        this.attemptReconnection();
      },
      onError: (error) => {
        logger.error('MULTIPLAYER', 'Connection error:', error);
      },
    });
  }

  private async attemptReconnection(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 1000; // Start with 1 second delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('MULTIPLAYER', `Reconnection attempt ${attempt}/${maxRetries}`);

        // Wait before attempting to reconnect (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));

        // Try to reconnect
        await this.connectionManager.connect();

        logger.info('MULTIPLAYER', 'Successfully reconnected to server');

        // Re-join the game
        this.playerSyncManager.joinGame();

        // Dispatch reconnection success event
        window.dispatchEvent(new CustomEvent('multiplayerReconnected'));

        return; // Success - exit the retry loop
      } catch (error) {
        logger.warn('MULTIPLAYER', `Reconnection attempt ${attempt} failed: ${String(error)}`);

        // If this was the last attempt, we need to handle permanent disconnection
        if (attempt === maxRetries) {
          logger.error(
            'MULTIPLAYER',
            'All reconnection attempts failed - connection permanently lost'
          );

          // Dispatch permanent disconnection event
          window.dispatchEvent(
            new CustomEvent('multiplayerPermanentlyDisconnected', {
              detail: { reason: 'Reconnection failed after multiple attempts' },
            })
          );
        }
      }
    }
  }
}
