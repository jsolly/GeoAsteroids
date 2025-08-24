import { v4 as uuidv4 } from 'uuid';
import type { PlayerJoin, PlayerLeave, PlayerUpdate, Position } from '../../shared-types';
import { BotManager } from '../entities/bot/botManager';
import type { Player } from '../entities/player/Player';
import { playerFactory } from '../entities/player/PlayerFactory';
import type { Roid } from '../entities/roid/Roid';
import { Ship } from '../entities/ship/Ship';
import { generateRandomPlayerColor } from '../utils/colorUtils';
import type { ClientMessage, GameState, ServerMessage } from './types';

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private socket: WebSocket | null = null;
  public players: Map<string, Player> = new Map();
  public localPlayerId: string;
  public localPlayerName: string;
  public isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  // Persist colors across re-initializations per remote player id
  private playerColors: Map<string, string> = new Map();
  private botManager: BotManager;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.localPlayerName = `Player_${Math.floor(Math.random() * 1000)}`;
    this.botManager = BotManager.getInstance();
  }

  public static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  // Method to set the local player name
  public setLocalPlayerName(name: string): void {
    this.localPlayerName = name;
  }

  // Method to get the local player name
  public getLocalPlayerName(): string {
    return this.localPlayerName;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.socket) {
        resolve();
        return;
      }

      try {
        const wsUrl = import.meta.env.VITE_WEBSOCKET_URL;

        this.socket = new WebSocket(wsUrl);

        // Set up connection promise handlers
        this.socket.onopen = (): void => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.joinGame();
          resolve();
        };

        this.socket.onerror = (error: Event): void => {
          console.error('MULTIPLAYER', 'WebSocket error', { error: error.type });
          this.handleConnectionError();
          reject(new Error('WebSocket connection failed'));
        };

        this.setupWebSocketHandlers();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('MULTIPLAYER', 'Failed to connect to multiplayer server', {
          error: errorMessage,
        });
        this.handleConnectionError();
        reject(new Error(errorMessage));
      }
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Note: onopen and onerror are now handled in the connect() method
    // Only set up message and close handlers here

    this.socket.onmessage = (event: MessageEvent): void => {
      const message = JSON.parse(event.data) as ServerMessage;
      this.handleServerMessage(message);
    };

    this.socket.onclose = (): void => {
      this.handleDisconnection();
    };
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'playerJoin':
        this.handlePlayerJoin(message.data as PlayerJoin);
        break;
      case 'playerLeave':
        this.handlePlayerLeave(message.data as PlayerLeave);
        break;
      case 'playerUpdate':
        this.handlePlayerUpdate(message.data as PlayerUpdate);
        break;
      case 'gameState':
        this.handleGameState(message.data as GameState);
        break;
      case 'error':
        if (typeof message.data === 'string') {
          console.error('MULTIPLAYER', 'Server error:', message.data);
        }
        break;
    }
  }

  private getOrCreateColor(playerId: string): string {
    const existing = this.playerColors.get(playerId);
    if (existing) {
      return existing;
    }
    const color = generateRandomPlayerColor();
    this.playerColors.set(playerId, color);
    return color;
  }

  private handlePlayerJoin(data: PlayerJoin): void {
    if (data.id !== this.localPlayerId) {
      const ship = new Ship();
      // Use the ship's network update method to handle position
      ship.updateFromNetwork({ position: data.position });

      const newPlayer = playerFactory.createRemotePlayer(data.id, data.name, data.position);

      // Set additional properties
      newPlayer.score = 0;
      newPlayer.lastUpdate = Date.now();
      newPlayer.lives = 3; // Default lives for new players
      newPlayer.spawnProtectedUntil = Date.now() + 3000; // 3 seconds spawn protection
      newPlayer.color = this.getOrCreateColor(data.id);

      // Update ship position
      newPlayer.ship.updateFromNetwork({ position: data.position });
      this.players.set(data.id, newPlayer);
    }
  }

  private handlePlayerLeave(data: PlayerLeave): void {
    const player = this.players.get(data.id);
    if (player) {
      this.players.delete(data.id);
    }
  }

  private handlePlayerUpdate(data: PlayerUpdate): void {
    if (data.id !== this.localPlayerId) {
      const player = this.players.get(data.id);
      if (player) {
        // Use the ship's network update method to handle all ship properties
        player.ship.updateFromNetwork(data);

        // Update player-specific properties using Object.assign
        const updates: Partial<Player> = {};
        if (data.lives !== undefined) {
          updates.lives = data.lives;
        }
        if (data.score !== undefined) {
          updates.score = data.score;
        }

        Object.assign(player, updates);

        player.lastUpdate = Date.now();
      }
    }
  }

  private handleGameState(data: GameState): void {
    // Determine which remote players are present in this snapshot
    const remoteIds = new Set(
      data.players.filter((p) => p.id !== this.localPlayerId).map((p) => p.id)
    );

    // Remove players that are no longer present
    for (const [id] of this.players.entries()) {
      if (id !== this.localPlayerId && !remoteIds.has(id)) {
        this.players.delete(id);
      }
    }

    // Upsert players from the snapshot (preserve existing color/state where appropriate)
    for (const playerData of data.players) {
      if (playerData.id === this.localPlayerId) {
        continue;
      }

      const existing = this.players.get(playerData.id);
      if (existing) {
        // Update in place to avoid re-initialization (preserve color, functions)
        existing.ship.updateFromNetwork(playerData);

        // Update player properties efficiently
        const updates: Partial<Player> = { score: playerData.score };
        if (playerData.lives !== undefined) {
          updates.lives = playerData.lives;
        }

        Object.assign(existing, updates);
        existing.lastUpdate = Date.now();
      } else {
        // Create new remote player once
        const newPlayer = playerFactory.createRemotePlayer(
          playerData.id,
          playerData.name,
          playerData.position
        );

        // Set additional properties
        newPlayer.score = playerData.score;
        newPlayer.lastUpdate = Date.now();
        newPlayer.lives = playerData.lives || 3;
        newPlayer.spawnProtectedUntil = Date.now() + 3000;
        newPlayer.color = this.getOrCreateColor(playerData.id);

        // Update ship from network data
        newPlayer.ship.updateFromNetwork(playerData);
        this.players.set(playerData.id, newPlayer);
      }
    }
  }

  private joinGame(): void {
    const joinMessage: ClientMessage = {
      type: 'join',
      data: {
        id: this.localPlayerId,
        name: this.localPlayerName,
        position: { x: 0, y: 0 }, // Use world origin instead of canvas center
      },
      timestamp: Date.now(),
    };
    this.sendMessage(joinMessage);
  }

  public updatePlayerState(update: Partial<PlayerUpdate>): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const updateMessage: ClientMessage = {
      type: 'update',
      data: {
        id: this.localPlayerId,
        position: update.position || { x: 0, y: 0 },
        velocity: update.velocity || { x: 0, y: 0 },
        r: update.r ?? 0,
        angle: update.angle ?? 0,
        lives: update.lives || 3,
        score: update.score || 0,
        exploding: update.exploding ?? false,
      },
      timestamp: Date.now(),
    };
    this.sendMessage(updateMessage);
  }

  private sendMessage(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleDisconnection(): void {
    this.players.clear();
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  // Unified player management - bots and remote players are treated similarly
  public initializeBots(count: number): void {
    this.botManager.createBots(count);
  }

  public getAllPlayers(): Map<string, Player> {
    // Combine remote players and bots into a single collection
    const allPlayers = new Map<string, Player>();

    // Add remote players
    for (const [id, player] of this.players.entries()) {
      allPlayers.set(id, player);
    }

    // Add bots
    const bots = this.botManager.getBots();
    for (const [id, bot] of bots.entries()) {
      allPlayers.set(id, bot);
    }

    return allPlayers;
  }

  public getBots(): Map<string, Player> {
    return this.botManager.getBots();
  }

  public getRemotePlayers(): Map<string, Player> {
    return this.players;
  }

  public empDestroyPlayer(_playerId: string): void {
    // EMP pulse destroys any player (bot or remote) - this will be handled by the respective manager
    // when the EMP pulse is processed
  }

  public updateLocalPlayerForAllPlayers(position: Position, alive: boolean): void {
    // Update local player position for both bots and remote players
    this.botManager.updateLocalPlayerPosition(position, alive);
    // Could also update for remote players if needed
  }

  public updateAllPlayerData(roids: Roid[], otherPlayers: Player[]): void {
    // Update data for all players (bots and remote players)
    this.botManager.setRoids(roids);
    this.botManager.setOtherPlayers(otherPlayers);
    // Could also update remote player data if needed
  }

  public getOtherPlayersArray(): Player[] {
    return Array.from(this.players.values());
  }

  public getAllPlayersArray(): Player[] {
    // Get all players (remote + bots) as an array
    const allPlayers: Player[] = [];

    // Add remote players
    for (const player of this.players.values()) {
      allPlayers.push(player);
    }

    // Add bots
    const bots = this.botManager.getBots();
    for (const bot of bots.values()) {
      allPlayers.push(bot);
    }

    return allPlayers;
  }

  public getPlayerById(playerId: string): Player | undefined {
    // Get player from either collection (remote players or bots)
    const remotePlayer = this.players.get(playerId);
    if (remotePlayer) {
      return remotePlayer;
    }

    // Check bots if not found in remote players
    const bots = this.botManager.getBots();
    return bots.get(playerId);
  }

  public getPlayerCount(): number {
    // Total count of all players (remote + bots)
    return this.players.size + this.botManager.getBots().size;
  }

  public getRemotePlayerCount(): number {
    return this.players.size;
  }

  public getBotCount(): number {
    return this.botManager.getBots().size;
  }

  public removePlayer(playerId: string): void {
    // Remove player from appropriate collection (bots or remote players)
    const remotePlayer = this.players.get(playerId);
    if (remotePlayer) {
      this.players.delete(playerId);

      // Dispatch event to notify other systems
      window.dispatchEvent(
        new CustomEvent('playerRemoved', {
          detail: {
            playerId,
            playerName: remotePlayer.name,
            reason: 'No lives remaining',
          },
        })
      );
      return;
    }

    // Check if it's a bot
    const bots = this.botManager.getBots();
    const botPlayer = bots.get(playerId);
    if (botPlayer) {
      // Note: Bot removal is handled by BotManager, not here
      // This is just for reference
    }
  }

  public disconnect(): void {
    if (this.socket) {
      const leaveMessage: ClientMessage = {
        type: 'leave',
        data: { id: this.localPlayerId },
        timestamp: Date.now(),
      };
      this.sendMessage(leaveMessage);
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.players.clear();
  }
}
