import { v4 as uuidv4 } from 'uuid';
import type { BotPlayer } from '../entities/bot/types';
import type { Player, Position } from '../entities/player/types';
import { Ship } from '../entities/ship/Ship';

import { generateRandomPlayerColor } from '../utils/colorUtils';
import { BotIntegrationManager } from './botIntegrationManager';
import type {
  ClientMessage,
  GameState,
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  ServerMessage,
} from './types';

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
  private botIntegration: BotIntegrationManager;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.localPlayerName = `Player_${Math.floor(Math.random() * 1000)}`;
    this.botIntegration = new BotIntegrationManager();
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
      try {
        if (typeof event.data === 'string') {
          const parsedData: unknown = JSON.parse(event.data);
          if (parsedData && typeof parsedData === 'object') {
            const message: ServerMessage = parsedData as ServerMessage;
            this.handleServerMessage(message);
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('MULTIPLAYER', 'Failed to parse server message', {
          error: errorMessage,
        });
      }
    };

    this.socket.onclose = (): void => {
      this.isConnected = false;
      this.handleDisconnection();
    };

    this.socket.onerror = (error: Event): void => {
      console.error('MULTIPLAYER', 'WebSocket error', { error: error.type });
      this.handleConnectionError();
    };
  }

  private handleServerMessage(message: ServerMessage): void {
    console.info('MULTIPLAYER', `Received server message: ${message.type}`, message);
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

      const newPlayer: Player = {
        id: data.id,
        name: data.name,
        ship,
        score: 0,
        lastUpdate: Date.now(),
        lives: 3, // Default lives for new players
        spawnProtectedUntil: Date.now() + 3000, // 3 seconds spawn protection
        color: this.getOrCreateColor(data.id),
        respawn: () => {},
        onShipExploded: () => {},
      };
      this.players.set(data.id, newPlayer);
      console.info('MULTIPLAYER', `Player ${data.name} joined the game`);
    }
  }

  private handlePlayerLeave(data: PlayerLeave): void {
    const player = this.players.get(data.id);
    if (player) {
      console.info('MULTIPLAYER', `Player ${player.name} left the game`);
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
    console.info('MULTIPLAYER', `Received game state with ${data.players.length} players`);
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
        const ship = new Ship();
        ship.updateFromNetwork(playerData);

        const newPlayer: Player = {
          id: playerData.id,
          name: playerData.name,
          ship,
          score: playerData.score,
          lastUpdate: Date.now(),
          lives: playerData.lives || 3,
          spawnProtectedUntil: Date.now() + 3000,
          color: this.getOrCreateColor(playerData.id),
          respawn: () => {},
          onShipExploded: () => {},
        };
        this.players.set(playerData.id, newPlayer);
        console.info('MULTIPLAYER', `Added player ${playerData.name} from game state`);
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

  // Minimal bot integration methods needed by GameController
  public enableBots(count: number): void {
    this.botIntegration.enableBots(count);
  }

  public disableBots(): void {
    this.botIntegration.disableBots();
  }

  public getBots(): Map<string, BotPlayer> {
    return this.botIntegration.manager.getBots();
  }

  public updateBotsInGameLoop(): void {
    // Bot movement and combat updates are handled by the BotManager
    // This method is called by the game loop to ensure bots are updated
    this.botIntegration.manager.updateBotsInGameLoop();
  }

  public empDestroyBot(_botId: string): void {
    // EMP pulse destroys a bot - this will be handled by the BotManager
    // when the EMP pulse is processed
  }

  public updateLocalPlayerForBots(position: Position, alive: boolean): void {
    this.botIntegration.updateLocalPlayerForBots(position, alive);
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);

      // Dispatch event to notify other systems
      window.dispatchEvent(
        new CustomEvent('playerRemoved', {
          detail: {
            playerId,
            playerName: player.name,
            reason: 'No lives remaining',
          },
        })
      );
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
