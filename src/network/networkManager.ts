import type { PlayerUpdate, Position, Velocity } from '../../shared-types';
import { SHIP } from '../constants';
import type { Player } from '../entities/player/Player';
import { logger } from '../utils/Logger';
import { ConnectionManager } from './services/ConnectionManager';

/**
 * Simplified NetworkManager for multiplayer-only game
 */
export class NetworkManager {
  private static instance: NetworkManager;

  private connectionManager: ConnectionManager;

  private constructor() {
    this.connectionManager = ConnectionManager.getInstance();
    this.setupConnectionHandlers();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
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
    logger.debug('NETWORK', `NetworkManager.setLocalPlayerName called with: ${name}`);
    this.connectionManager.setLocalPlayerName(name);
  }

  getLocalPlayerName(): string {
    return this.connectionManager.getLocalPlayerName();
  }

  getLocalPlayerId(): string {
    return this.connectionManager.getLocalPlayerId();
  }

  getAllPlayers(): Player[] {
    return this.connectionManager.getAllPlayers();
  }

  getRemotePlayers(): Player[] {
    return this.connectionManager.getRemotePlayers();
  }

  getPlayer(playerId: string): Player | undefined {
    return this.connectionManager.getPlayer(playerId);
  }

  private outboundPlayerState: PlayerUpdate = {
    id: '',
    name: '',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    r: 0,
    angle: 0,
    lives: 0,
    score: 0,
    exploding: false,
    health: SHIP.MAX_HEALTH,
    maxHealth: SHIP.MAX_HEALTH,
  };

  // Player state synchronization - just send input to server
  updatePlayerState(playerState: {
    position: Position;
    velocity: Velocity;
    r: number;
    angle: number;
    lives: number;
    score: number;
    exploding: boolean;
    thrusting?: boolean;
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
    const dest = this.outboundPlayerState;
    dest.id = this.getLocalPlayerId() || this.connectionManager.getClientId();
    dest.name = this.getLocalPlayerName();
    dest.position = playerState.position;
    dest.velocity = playerState.velocity;
    dest.r = playerState.r;
    dest.angle = playerState.angle;
    dest.lives = playerState.lives;
    dest.score = playerState.score;
    dest.exploding = playerState.exploding;
    dest.health = playerState.health ?? SHIP.MAX_HEALTH;
    dest.maxHealth = playerState.maxHealth ?? SHIP.MAX_HEALTH;
    if (playerState.thrusting !== undefined) {
      dest.thrusting = playerState.thrusting;
    } else {
      delete dest.thrusting;
    }
    if (playerState.lasers !== undefined) {
      dest.lasers = playerState.lasers;
    } else {
      delete dest.lasers;
    }
    this.connectionManager.sendPlayerState(dest);
  }

  sendShootEvent(laserPosition: Position, laserVelocity: Velocity): void {
    this.connectionManager.sendShootEvent(laserPosition, laserVelocity);
  }

  // Initialize asteroid sync - server is authoritative
  initializeAsteroidSync(): void {
    this.connectionManager.initializeAsteroidSync();
  }

  // Send a generic message to the server
  sendMessage(message: Record<string, unknown>): void {
    this.connectionManager.sendMessage(message);
  }

  private setupConnectionHandlers(): void {
    // Listen for connection events
    window.addEventListener('networkConnected', () => {
      logger.info('NETWORK', 'Connected to game server');
    });

    window.addEventListener('networkDisconnected', (event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      logger.warn('NETWORK', `Disconnected: ${customEvent.detail.reason}`);
    });

    window.addEventListener('networkReconnected', () => {
      logger.info('NETWORK', 'Reconnected to game server');
    });
  }
}
