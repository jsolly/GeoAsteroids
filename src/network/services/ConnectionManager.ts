import type {
  AsteroidData,
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  Position,
  ServerGameState,
  Velocity,
} from '../../../shared-types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Player } from '../../entities/player/Player';
import { PlayerManager } from '../../entities/player/PlayerManager';
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
    // Join uses clientId until the server `joined` echo sets localPlayerId (same value).
    return this.localPlayerId || this.clientId;
  }

  private getLocalPlayerColor(): string {
    // Get the local player's color from the player manager
    const playerManager = PlayerManager.getInstance();
    const localPlayer = playerManager.getLocalPlayer();
    return localPlayer?.color || '#00ff00'; // Fallback to green if not found
  }

  private getLocalPlayerPosition(): { x: number; y: number } {
    return { x: 400, y: 300 };
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

  // Send shoot event to server
  sendShootEvent(laserPosition: Position, laserVelocity: Velocity): void {
    if (!this.state.isConnected || !this.state.socket) {
      logger.debug('NETWORK', 'Cannot send shoot event - not connected or no socket');
      return;
    }

    const message: ClientMessage = {
      type: 'shoot',
      id: this.localPlayerId || this.clientId,
      data: {
        laserStart: laserPosition,
        laserDirection: laserVelocity,
      },
      timestamp: Date.now(),
    };

    logger.debug('NETWORK', 'Sending shoot message to server', { message });
    this.state.socket.send(JSON.stringify(message));
  }

  // Initialize asteroid sync
  initializeAsteroidSync(): void {
    if (!this.state.isConnected || !this.state.socket) {
      logger.warn('NETWORK', 'Cannot initialize asteroid sync - not connected');
      return;
    }

    logger.debug('NETWORK', `Initializing asteroid sync with player name: ${this.localPlayerName}`);

    // Align local player id with join id before the first gameState (avoids a
    // transient remote duplicate keyed by clientId).
    const localPlayer = PlayerManager.getInstance().getLocalPlayer();
    if (localPlayer) {
      localPlayer.id = this.clientId;
    }

    // Get the player's current position
    const playerPosition = this.getLocalPlayerPosition();

    // First join the game
    const joinMessage: ClientMessage = {
      type: 'join',
      id: this.clientId,
      data: {
        name: this.localPlayerName,
        color: this.getLocalPlayerColor(),
        position: playerPosition,
      },
      timestamp: Date.now(),
    };

    logger.debug('NETWORK', 'Sending join message', { message: joinMessage });
    const jsonString = JSON.stringify(joinMessage);
    this.state.socket.send(jsonString);

    // Initialize asteroids after joining
    setTimeout(() => {
      this.initializeAsteroids();
    }, 100); // Small delay to ensure join message is processed
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

  // Send a generic message to the server
  sendMessage(message: Record<string, unknown>): void {
    if (!this.state.isConnected || !this.state.socket) {
      return;
    }

    this.state.socket.send(JSON.stringify(message));
    logger.debug('NETWORK', 'Sent message', { message });
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
      case 'botCreated':
        this.handleBotCreated(data as { botId: string; botName: string; position: Position });
        break;
      case 'botUpdate':
        this.handleBotUpdated(
          data as {
            botId: string;
            playerId: string;
            position: Position;
            velocity: Velocity;
            angle: number;
            exploding: boolean;
            thrusting?: boolean;
            color: string;
            lives: number;
            health: number;
            maxHealth: number;
          }
        );
        break;
      case 'botDestroyed':
        this.handleBotDestroyed(data as { botId: string });
        break;
      case 'playerShoot':
        this.handlePlayerShoot(
          data as {
            id: string;
            laserStart: Position;
            laserDirection: Velocity;
          }
        );
        break;
      case 'playerUpdate':
        // Handle player update messages (currently just log them)
        logger.debug('NETWORK', 'Received player update', { data });
        break;
      case 'playerDamaged':
        this.handlePlayerDamaged(
          data as {
            targetPlayerId: string;
            attackerId: string;
            damage: number;
            remainingHealth: number;
            isDestroyed: boolean;
            remainingLives?: number;
          }
        );
        break;
      case 'playerKilled':
        this.handlePlayerKilled(
          data as {
            targetPlayerId: string;
            targetPlayerName: string;
            attackerId: string;
          }
        );
        break;
      case 'error':
        // Handle error messages from server
        logger.warn('NETWORK', 'Server error', { error: data });
        break;
      default:
        logger.debug('NETWORK', 'Unhandled server message type', { type: message.type });
    }
  }

  private handleGameState(data: ServerGameState): void {
    // Update local game state from server using unified entity system
    if (data.entities) {
      // Update entities in place - no clearing to prevent bot disappearance!
      for (const entityData of data.entities) {
        const isLocalPlayer =
          entityData.id === this.clientId || entityData.id === this.localPlayerId;

        let entity = this.allPlayers.get(entityData.id);

        if (!entity) {
          if (isLocalPlayer) {
            // Adopt the game-loop's local player as the single source of truth
            // for the local ship, so server-authoritative state (health, score,
            // lives, respawn) flows into the same object the game loop renders,
            // collides, and attributes damage with. Align its id to the
            // server-assigned id.
            const localPlayer = PlayerManager.getInstance().getLocalPlayer();
            if (localPlayer) {
              localPlayer.id = entityData.id;
              if (this.localPlayerName) {
                localPlayer.name = this.localPlayerName;
              }
              entity = localPlayer;
            }
          }

          if (!entity) {
            entity = entityFactory.createPlayer({
              id: entityData.id,
              name: entityData.name,
              type: entityData.type === 'bot' ? 'bot' : 'remote',
              color: entityData.color,
            });
          }

          this.allPlayers.set(entityData.id, entity);
        } else if (isLocalPlayer) {
          const localPlayer = PlayerManager.getInstance().getLocalPlayer();
          if (localPlayer && entity !== localPlayer) {
            this.allPlayers.delete(entityData.id);
            localPlayer.id = entityData.id;
            if (this.localPlayerName) {
              localPlayer.name = this.localPlayerName;
            }
            entity = localPlayer;
            this.allPlayers.set(entityData.id, entity);
          }
        }

        const serverSnapshot = {
          position: entityData.position,
          velocity: entityData.velocity,
          angle: entityData.angle,
          lives: entityData.lives,
          score: entityData.score,
          exploding: entityData.exploding,
          thrusting: entityData.thrusting,
          color: entityData.color,
          health: entityData.health,
          maxHealth: entityData.maxHealth,
          respawnTimer: entityData.respawnTimer,
          spawnProtectionTimer: entityData.spawnProtectionTimer,
        };
        entity.updateFromServer(serverSnapshot);

        if (isLocalPlayer) {
          const localPlayer = PlayerManager.getInstance().getLocalPlayer();
          if (localPlayer && localPlayer !== entity) {
            localPlayer.updateFromServer(serverSnapshot);
          }
        }
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
    setTimeout(() => {
      this.initializeAsteroids();
    }, 100);
  }

  private handlePlayerJoined(data: PlayerJoin): void {
    logger.info('NETWORK', 'Player joined', data as unknown as Record<string, unknown>);
    // Player handling is now done through unified entity system in handleGameState
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
        const event = new CustomEvent('serverAsteroidCreated', {
          detail: { asteroid },
        });
        window.dispatchEvent(event);
      }
    } else {
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

  private handleBotCreated(data: { botId: string; botName: string; position: Position }): void {
    logger.debug('NETWORK', 'Bot created', { botId: data.botId, botName: data.botName });
    // Bot handling is now done through unified entity system in handleGameState
  }

  private handleBotUpdated(data: {
    botId: string;
    playerId: string;
    position: Position;
    velocity: Velocity;
    angle: number;
    exploding: boolean;
    thrusting?: boolean;
    color: string;
    lives: number;
    health: number;
    maxHealth: number;
  }): void {
    logger.debug('NETWORK', 'Bot updated', {
      botId: data.botId,
      health: data.health,
      exploding: data.exploding,
    });
    // Bot handling is now done through unified entity system in handleGameState
  }

  private handleBotDestroyed(data: { botId: string }): void {
    logger.debug('NETWORK', 'Bot destroyed', { botId: data.botId });

    if (data.botId) {
      this.allPlayers.delete(data.botId);
    }
  }

  private handlePlayerShoot(data: {
    id: string;
    laserStart: Position;
    laserDirection: Velocity;
  }): void {
    logger.debug('NETWORK', 'Client received playerShoot message', data);
    logger.debug('NETWORK', 'Player shot laser', {
      playerId: data.id,
      laserStart: data.laserStart,
      laserDirection: data.laserDirection,
    });

    const player = this.allPlayers.get(data.id);
    if (!player) {
      logger.debug('NETWORK', 'Player not found for laser shot', { playerId: data.id });
      logger.warn('NETWORK', 'Received laser shot for unknown player', { playerId: data.id });
      return;
    }

    // Create a laser for the remote player
    const laser = entityFactory.createLaser({
      position: data.laserStart,
      velocity: data.laserDirection,
      distTraveled: 0,
      explodeTime: 0,
      hasExploded: false,
    });

    // Add the laser to the player's ship
    player.ship.lasers.push(laser);
    logger.debug('NETWORK', 'Added laser to remote player', {
      playerId: data.id,
      laserCount: player.ship.lasers.length,
    });
  }

  private handlePlayerDamaged(data: {
    targetPlayerId: string;
    attackerId: string;
    damage: number;
    remainingHealth: number;
    isDestroyed: boolean;
    remainingLives?: number;
  }): void {
    logger.debug('NETWORK', 'Player damaged', {
      targetPlayerId: data.targetPlayerId,
      attackerId: data.attackerId,
      damage: data.damage,
      remainingHealth: data.remainingHealth,
      isDestroyed: data.isDestroyed,
      remainingLives: data.remainingLives,
    });

    const localPlayer = PlayerManager.getInstance().getLocalPlayer();
    const isLocalTarget = Boolean(
      localPlayer &&
        (localPlayer.id === data.targetPlayerId || this.getLocalPlayerId() === data.targetPlayerId)
    );
    const prevLocalLives =
      isLocalTarget && localPlayer && data.remainingLives !== undefined
        ? localPlayer.lives
        : undefined;

    let targetPlayer = this.allPlayers.get(data.targetPlayerId);
    if (!targetPlayer) {
      if (isLocalTarget && localPlayer) {
        targetPlayer = localPlayer;
        this.allPlayers.set(data.targetPlayerId, localPlayer);
      }
    }
    if (!targetPlayer) {
      logger.warn('NETWORK', 'Player not found for damage', {
        targetPlayerId: data.targetPlayerId,
      });
      return;
    }

    if (data.remainingLives !== undefined) {
      targetPlayer.lives = data.remainingLives;
    }

    this.applyDamageToLocalPlayerIfTarget(data);

    targetPlayer.ship.health = data.remainingHealth;
    if (targetPlayer.type === 'local') {
      targetPlayer.syncServerHealthEcho(data.remainingHealth);
    }

    if (data.remainingHealth > 0 && data.damage > 0) {
      targetPlayer.ship.takeDamage(0, data.attackerId);
    }

    if (data.isDestroyed && !targetPlayer.ship.exploding) {
      targetPlayer.ship.explode(data.attackerId);
    }

    if (
      localPlayer &&
      prevLocalLives !== undefined &&
      data.remainingLives !== undefined &&
      prevLocalLives > data.remainingLives
    ) {
      this.dispatchLocalPlayerDied(localPlayer, data.remainingLives, data.attackerId);
    }
  }

  /** Fire playerDied when server reports a life loss before game-state sync arrives. */
  private dispatchLocalPlayerDied(
    localPlayer: Player,
    remainingLives: number,
    deathCause: string
  ): void {
    window.dispatchEvent(
      new CustomEvent('playerDied', {
        detail: {
          playerId: localPlayer.id,
          deathCause,
          isGameOver: remainingLives <= 0,
        },
      })
    );
  }

  /** Keep PlayerManager's local ship in sync when damage hits a network duplicate. */
  private applyDamageToLocalPlayerIfTarget(data: {
    targetPlayerId: string;
    remainingHealth: number;
    remainingLives?: number;
    isDestroyed: boolean;
    attackerId: string;
  }): void {
    const localPlayer = PlayerManager.getInstance().getLocalPlayer();
    if (!localPlayer) {
      return;
    }
    const isLocalTarget =
      localPlayer.id === data.targetPlayerId || this.getLocalPlayerId() === data.targetPlayerId;
    if (!isLocalTarget) {
      return;
    }

    localPlayer.ship.health = data.remainingHealth;
    localPlayer.syncServerHealthEcho(data.remainingHealth);
    if (data.remainingLives !== undefined) {
      localPlayer.lives = data.remainingLives;
    }
    if (data.isDestroyed && !localPlayer.ship.exploding) {
      localPlayer.ship.explode(data.attackerId);
    }
  }

  private handlePlayerKilled(data: {
    targetPlayerId: string;
    targetPlayerName: string;
    attackerId: string;
  }): void {
    const localId = this.localPlayerId ?? this.clientId;
    if (data.attackerId !== localId) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('remotePlayerDied', {
        detail: {
          playerId: data.targetPlayerId,
          playerName: data.targetPlayerName,
          deathCause: 'laser',
        },
      })
    );
  }
}
