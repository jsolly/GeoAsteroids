import type {
  AsteroidData,
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  ServerGameState,
} from '../../../shared-types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Player } from '../../entities/player/Player';
import { logger } from '../../utils/Logger';
import type { ClientMessage, ServerMessage } from '../types';

export interface ConnectionState {
  isConnected: boolean;
  socket: WebSocket | null;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private state: ConnectionState;

  private clientId: string;
  private localPlayerName: string = '';
  private localPlayerId: string = '';
  private allPlayers: Map<string, Player> = new Map();
  private seenAsteroidIds: Set<string> = new Set(); // Track asteroids we've already seen

  private constructor() {
    this.state = {
      isConnected: false,
      socket: null,
    };
    this.clientId = this.generateClientId();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  getSocket(): WebSocket | null {
    return this.state.socket;
  }

  getClientId(): string {
    return this.clientId;
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  private generateClientId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `client-${timestamp}-${randomPart}`;
  }

  async connect(): Promise<void> {
    if (this.state.isConnected || this.state.socket) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const computedUrl =
          typeof window !== 'undefined'
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
            : 'ws://localhost:3001/ws';

        const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || computedUrl;
        logger.debug('NETWORK', 'Connecting to WebSocket', { url: wsUrl });
        this.state.socket = new WebSocket(wsUrl);

        this.state.socket.onopen = (): void => {
          this.state.isConnected = true;
          logger.info('NETWORK', 'Connected to server');
          window.dispatchEvent(new CustomEvent('networkConnected'));
          resolve();
        };

        this.state.socket.onerror = (): void => {
          logger.error('NETWORK', 'WebSocket connection error');
          reject(new Error('WebSocket connection failed'));
        };

        this.state.socket.onclose = (): void => {
          this.state.isConnected = false;
          this.state.socket = null;
          logger.warn('NETWORK', 'WebSocket connection closed');
          window.dispatchEvent(
            new CustomEvent('networkDisconnected', {
              detail: { reason: 'Connection closed' },
            })
          );
        };

        this.state.socket.onmessage = (event: MessageEvent): void => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            logger.error(
              'NETWORK',
              'Failed to parse server message',
              error instanceof Error ? error : new Error(String(error))
            );
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.state.socket) {
      this.state.socket.close();
      this.state.isConnected = false;
      this.state.socket = null;
    }
  }

  // Player management
  setLocalPlayerName(name: string): void {
    logger.debug('NETWORK', `Setting local player name: ${name}`);
    this.localPlayerName = name;
  }

  getLocalPlayerName(): string {
    return this.localPlayerName;
  }

  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.allPlayers.values());
  }

  getRemotePlayers(): Player[] {
    return Array.from(this.allPlayers.values()).filter((p) => p.type === 'remote');
  }

  getPlayer(playerId: string): Player | undefined {
    return this.allPlayers.get(playerId);
  }

  // Send player state to server
  sendPlayerState(playerState: PlayerUpdate): void {
    if (!this.state.isConnected || !this.state.socket) {
      return;
    }

    const message: ClientMessage = {
      type: 'update',
      data: playerState,
      timestamp: Date.now(),
    };

    this.state.socket.send(JSON.stringify(message));
  }

  // Initialize asteroid sync
  initializeAsteroidSync(): void {
    if (!this.state.isConnected || !this.state.socket) {
      logger.warn('NETWORK', 'Cannot initialize asteroid sync - not connected');
      return;
    }

    logger.debug('NETWORK', `Initializing asteroid sync with player name: ${this.localPlayerName}`);

    // First join the game
    const joinMessage: ClientMessage = {
      type: 'join',
      id: this.clientId,
      data: { name: this.localPlayerName },
      timestamp: Date.now(),
    };

    logger.debug('NETWORK', 'Sending join message', { message: joinMessage });
    this.state.socket.send(JSON.stringify(joinMessage));
  }

  // Initialize asteroids after joining
  private initializeAsteroids(): void {
    if (!this.state.isConnected || !this.state.socket) {
      logger.warn('NETWORK', 'Cannot initialize asteroids - not connected');
      return;
    }

    logger.debug('NETWORK', 'Sending initAsteroids message', {
      playerId: this.localPlayerId,
      asteroidCount: 10,
    });

    const message: ClientMessage = {
      type: 'initAsteroids',
      id: this.localPlayerId,
      data: { asteroidCount: 10 },
      timestamp: Date.now(),
    };

    this.state.socket.send(JSON.stringify(message));
    logger.debug('NETWORK', 'Sent initAsteroids message', { message });
  }

  private handleServerMessage(message: ServerMessage): void {
    // Prefer message.data, fallback to message.payload for backward compatibility
    const data = (message.data ?? message.payload) as unknown;
    switch (message.type) {
      case 'gameState':
        this.handleGameState(data as ServerGameState);
        break;
      case 'joined':
        this.handleJoined(data as PlayerJoin);
        break;
      case 'playerJoined':
        this.handlePlayerJoined(data as PlayerJoin);
        break;
      case 'playerLeft':
        this.handlePlayerLeft(data as PlayerLeave);
        break;
      case 'asteroidCreate':
        this.handleAsteroidCreated(data as { asteroid: AsteroidData });
        break;
      case 'asteroidCreateBatch':
        this.handleAsteroidCreateBatch(data as { asteroids: AsteroidData[] });
        break;
      case 'asteroidUpdate':
        this.handleAsteroidUpdated(data as { asteroidId: string; updates: Partial<AsteroidData> });
        break;
      case 'asteroidDestroy':
        this.handleAsteroidDestroyed(data as { asteroidId: string });
        break;
      default:
        logger.debug('NETWORK', 'Unhandled server message type', { type: message.type });
    }
  }

  private handleGameState(data: ServerGameState): void {
    // Update local game state from server
    if (data.players) {
      this.allPlayers.clear();

      // Create player objects from server data
      for (const playerData of data.players) {
        // Use clientId to identify local player, since localPlayerId might not be set yet
        const isLocalPlayer =
          playerData.id === this.clientId || playerData.id === this.localPlayerId;

        // For local player, preserve the existing name if we have one
        const playerName =
          isLocalPlayer && this.localPlayerName ? this.localPlayerName : playerData.name;

        logger.debug('NETWORK', `Creating player from server data`, {
          id: playerData.id,
          serverName: playerData.name,
          finalName: playerName,
          isLocalPlayer,
          clientId: this.clientId,
          localPlayerId: this.localPlayerId,
          localPlayerName: this.localPlayerName,
        });

        const player = entityFactory.createPlayer({
          id: playerData.id,
          name: playerName,
          type: isLocalPlayer ? 'local' : 'remote',
        });

        // Update player state from server data
        if (playerData.position) {
          player.ship.position = playerData.position;
        }
        if (playerData.velocity) {
          player.ship.velocity = playerData.velocity;
        }
        // Server sends 'rotation', client uses 'angle'
        if (playerData.rotation !== undefined) {
          player.ship.angle = playerData.rotation;
        }
        if (playerData.lives !== undefined) {
          player.lives = playerData.lives;
        }
        if (playerData.score !== undefined) {
          player.score = playerData.score;
        }
        if (playerData.exploding !== undefined) {
          player.ship.exploding = playerData.exploding;
        }
        if (playerData.health !== undefined) {
          player.ship.health = playerData.health;
        }
        if (playerData.maxHealth !== undefined) {
          player.ship.maxHealth = playerData.maxHealth;
        }

        this.allPlayers.set(player.id, player);
      }
    }

    // Handle bots if present
    if (data.bots) {
      for (const botData of data.bots) {
        const bot = entityFactory.createPlayer({
          id: botData.id,
          name: botData.name,
          type: 'bot',
        });

        // Update bot state from server data
        if (botData.position) {
          bot.ship.position = botData.position;
        }
        if (botData.velocity) {
          bot.ship.velocity = botData.velocity;
        }
        if (botData.angle !== undefined) {
          bot.ship.angle = botData.angle;
        }
        if (botData.exploding !== undefined) {
          bot.ship.exploding = botData.exploding;
        }
        if (botData.lives !== undefined) {
          bot.lives = botData.lives;
        }
        if (botData.health !== undefined) {
          bot.ship.health = botData.health;
        }
        if (botData.maxHealth !== undefined) {
          bot.ship.maxHealth = botData.maxHealth;
        }

        this.allPlayers.set(bot.id, bot);
      }
    }

    // Dispatch asteroid events only for NEW asteroids
    if (data.asteroids) {
      for (const asteroidData of data.asteroids) {
        // Only dispatch event if we haven't seen this asteroid before
        if (!this.seenAsteroidIds.has(asteroidData.id)) {
          this.seenAsteroidIds.add(asteroidData.id);
          window.dispatchEvent(
            new CustomEvent('serverAsteroidCreated', {
              detail: { asteroid: asteroidData },
            })
          );
        }
      }
    }
  }

  private handleJoined(data: PlayerJoin): void {
    logger.info(
      'NETWORK',
      'Player joined successfully',
      data as unknown as Record<string, unknown>
    );

    // Store the local player ID from server response
    if (data.id) {
      this.localPlayerId = data.id;
    }

    // Now that we're joined, initialize asteroids
    this.initializeAsteroids();
  }

  private handlePlayerJoined(data: PlayerJoin): void {
    logger.info('NETWORK', 'Player joined', data as unknown as Record<string, unknown>);

    // Create player object from server data
    const player = entityFactory.createPlayer({
      id: data.id,
      name: data.name,
      type: 'remote',
    });

    if (data.position) {
      player.ship.position = data.position;
    }

    this.allPlayers.set(player.id, player);
  }

  private handlePlayerLeft(data: PlayerLeave): void {
    logger.info('NETWORK', 'Player left', data as unknown as Record<string, unknown>);
    if (data.id) {
      this.allPlayers.delete(data.id);
    }
  }

  private handleAsteroidCreated(data: { asteroid: AsteroidData }): void {
    window.dispatchEvent(
      new CustomEvent('serverAsteroidCreated', {
        detail: { asteroid: data.asteroid },
      })
    );
  }

  private handleAsteroidCreateBatch(data: { asteroids: AsteroidData[] }): void {
    if (data.asteroids && Array.isArray(data.asteroids)) {
      for (const asteroid of data.asteroids) {
        window.dispatchEvent(
          new CustomEvent('serverAsteroidCreated', {
            detail: { asteroid },
          })
        );
      }
    }
  }

  private handleAsteroidUpdated(data: {
    asteroidId: string;
    updates: Partial<AsteroidData>;
  }): void {
    window.dispatchEvent(
      new CustomEvent('serverAsteroidUpdated', {
        detail: {
          asteroidId: data.asteroidId,
          updates: data.updates,
        },
      })
    );
  }

  private handleAsteroidDestroyed(data: { asteroidId: string }): void {
    window.dispatchEvent(
      new CustomEvent('serverAsteroidDestroyed', {
        detail: { asteroidId: data.asteroidId },
      })
    );
  }
}
