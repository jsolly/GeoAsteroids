import type { Position, Velocity } from '../../shared-types';
import type { Player } from '../entities/player/Player';
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

  private constructor() {
    this.connectionManager = ConnectionManager.getInstance();
    this.playerSyncManager = PlayerSyncManager.getInstance();
    this.botSyncManager = BotSyncManager.getInstance();

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
    const wsUrl = import.meta.env?.VITE_WEBSOCKET_URL || 'ws://localhost:3001/ws';
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

  private setupConnectionHandlers(): void {
    this.connectionManager.setConnectionHandlers({
      onConnect: () => {
        console.debug('MULTIPLAYER', 'Connected to multiplayer server');
        this.playerSyncManager.joinGame();
      },
      onDisconnect: () => {
        console.debug('MULTIPLAYER', 'Disconnected from multiplayer server');
        // Handle disconnection cleanup if needed
      },
      onError: (error) => {
        console.error('MULTIPLAYER', 'Connection error:', error);
      },
    });
  }
}
