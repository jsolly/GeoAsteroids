import type {
  AsteroidData,
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  Position,
  ServerGameState,
  Velocity,
} from '../../../shared-types';
import { PALETTE } from '../../constants';
import { entityFactory } from '../../entities/EntityFactory';
import type { Player } from '../../entities/player/Player';
import { PlayerManager } from '../../entities/player/PlayerManager';
import { shouldApplyDamagedHealth } from '../../entities/ship/shipUtils';
import { logger } from '../../utils/Logger';
import type { ClientMessage, ServerMessage } from '../types';
import {
  CONNECTION_STALE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  isConnectionStale,
} from './connectionHealth';
import { bindPageHideDisconnect, staleRemotePlayerIds } from './playerPresence';

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
  private hasInitializedAsteroidsForConnection = false;

  // Heartbeat / half-open-socket detection (see connectionHealth.ts).
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastServerMessageAt = 0;

  private constructor() {
    this.state = {
      isConnected: false,
      socket: null,
    };
    this.clientId = this.generateClientId();
    // Tab close / bfcache must tear the socket down so the server drops us
    // and other clients can prune this player from their leaderboard.
    bindPageHideDisconnect(() => this.disconnect());
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
          this.lastServerMessageAt = Date.now();
          this.startHeartbeat();
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
          this.stopHeartbeat();
          logger.warn('NETWORK', 'WebSocket connection closed');
          window.dispatchEvent(
            new CustomEvent('networkDisconnected', {
              detail: { reason: 'Connection closed' },
            })
          );
        };

        this.state.socket.onmessage = (event: MessageEvent): void => {
          // Any inbound traffic (game state, pong, etc.) proves the link is alive.
          this.lastServerMessageAt = Date.now();
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
    this.stopHeartbeat();
    if (this.state.socket) {
      this.state.socket.close();
      this.state.isConnected = false;
      this.state.socket = null;
    }
    this.seenAsteroidIds.clear();
    this.hasInitializedAsteroidsForConnection = false;
    this.localPlayerId = '';
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Periodic liveness check. Pings the server (which replies with `pong`,
   * refreshing lastServerMessageAt) and, if nothing has been heard within the
   * stale timeout, tears the socket down locally so the disconnect surfaces in
   * the UI — even for half-open/zombie sockets the browser hasn't reported.
   */
  private checkHeartbeat(): void {
    const socket = this.state.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } catch {
      // A throwing send on an OPEN socket means it is broken; stale check closes it.
    }

    if (isConnectionStale(this.lastServerMessageAt, Date.now())) {
      logger.warn('NETWORK', 'No server traffic within timeout; treating connection as lost', {
        msSinceLastMessage: Date.now() - this.lastServerMessageAt,
        timeoutMs: CONNECTION_STALE_TIMEOUT_MS,
      });
      this.stopHeartbeat();
      // close() drives onclose -> networkDisconnected -> disconnect banner.
      try {
        socket.close();
      } catch {
        this.state.isConnected = false;
        this.state.socket = null;
        window.dispatchEvent(
          new CustomEvent('networkDisconnected', { detail: { reason: 'Connection timed out' } })
        );
      }
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
    return localPlayer?.color || PALETTE.LOCAL;
  }

  private getLocalPlayerPosition(): { x: number; y: number } {
    const localPlayer = PlayerManager.getInstance().getLocalPlayer();
    if (localPlayer?.ship?.position) {
      return { x: localPlayer.ship.position.x, y: localPlayer.ship.position.y };
    }
    return { x: 0, y: 0 };
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
  }

  // Initialize asteroids after the server acknowledges join
  private initializeAsteroids(): void {
    if (this.hasInitializedAsteroidsForConnection) {
      return;
    }
    if (!this.state.isConnected || !this.state.socket) {
      logger.warn('NETWORK', 'Cannot initialize asteroids - not connected');
      return;
    }
    if (!this.localPlayerId) {
      logger.warn('NETWORK', 'Cannot initialize asteroids - missing local player id');
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
    this.hasInitializedAsteroidsForConnection = true;
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

      // Server never sends playerLeft; drop remotes that vanished from the
      // snapshot so a closed tab leaves the leaderboard. Bots are left alone.
      const snapshotIds = new Set(data.entities.map((entity) => entity.id));
      for (const id of staleRemotePlayerIds(this.allPlayers.values(), snapshotIds)) {
        this.allPlayers.delete(id);
        logger.info('NETWORK', 'Removed departed remote player', { id });
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

    this.seenAsteroidIds.clear();
    this.hasInitializedAsteroidsForConnection = false;

    // Store the local player ID from server response
    if (data.id) {
      this.localPlayerId = data.id;
    }
    this.initializeAsteroids();
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
        if (this.seenAsteroidIds.has(asteroid.id)) {
          continue;
        }
        this.seenAsteroidIds.add(asteroid.id);
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

    this.applyAuthoritativeDamageHealth(targetPlayer, data.remainingHealth, data.isDestroyed);

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

    this.applyAuthoritativeDamageHealth(localPlayer, data.remainingHealth, data.isDestroyed);
    if (data.remainingLives !== undefined) {
      localPlayer.lives = data.remainingLives;
    }
    if (data.isDestroyed && !localPlayer.ship.exploding) {
      localPlayer.ship.explode(data.attackerId);
    }
  }

  /** Never raise health from playerDamaged — ignored hits echo remainingHealth=100. */
  private applyAuthoritativeDamageHealth(
    player: Player,
    remainingHealth: number,
    isDestroyed: boolean
  ): void {
    if (!shouldApplyDamagedHealth(player.ship.health, remainingHealth, isDestroyed)) {
      return;
    }
    player.ship.health = remainingHealth;
    if (player.type === 'local') {
      player.syncServerHealthEcho(remainingHealth);
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
