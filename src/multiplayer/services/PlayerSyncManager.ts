import { v4 as uuidv4 } from 'uuid';
import type {
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  Position,
  Velocity,
} from '../../../shared-types';
import { entityFactory } from '../../entities/EntityFactory';
import { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import {
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../../utils/positionUtils';
import type { ClientMessage } from '../types';
import { ConnectionManager } from './ConnectionManager';

export interface PlayerSyncState {
  players: Map<string, Player>;
  localPlayerId: string;
  localPlayerName: string;
  playerColors: Map<string, string>; // Persist colors across re-initializations
}

export class PlayerSyncManager {
  private static instance: PlayerSyncManager;
  private state: PlayerSyncState;
  private connectionManager: ConnectionManager;

  private constructor() {
    this.state = {
      players: new Map(),
      localPlayerId: uuidv4(),
      localPlayerName: `Player_${Math.floor(Math.random() * 1000)}`,
      playerColors: new Map(),
    };
    this.connectionManager = ConnectionManager.getInstance();
    this.setupMessageHandlers();
  }

  static getInstance(): PlayerSyncManager {
    if (!PlayerSyncManager.instance) {
      PlayerSyncManager.instance = new PlayerSyncManager();
    }
    return PlayerSyncManager.instance;
  }

  /**
   * Initialize the local player
   */
  initialize(): void {
    // Local player is created by the game controller, so we just need to track it
  }

  /**
   * Join the game by sending player info to server
   */
  joinGame(): void {
    const joinMessage: ClientMessage = {
      type: 'join',
      id: this.state.localPlayerId,
      data: {
        name: this.state.localPlayerName,
      },
      timestamp: Date.now(),
    };
    console.debug('MULTIPLAYER', 'Joining game with local player', {
      id: this.state.localPlayerId,
      name: this.state.localPlayerName,
    });
    this.connectionManager.sendMessage(joinMessage);
  }

  /**
   * Update local player state to server
   */
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
    const updateMessage: ClientMessage = {
      type: 'update',
      id: this.state.localPlayerId,
      data: {
        position: playerState.position,
        velocity: playerState.velocity,
        r: playerState.r,
        angle: playerState.angle,
        lives: playerState.lives,
        // Note: Score is now server-authoritative, so we don't send local score updates
        // The server will broadcast score updates when they change
        exploding: playerState.exploding,
        health: playerState.health,
        maxHealth: playerState.maxHealth,
        lasers: playerState.lasers,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(updateMessage);
  }

  /**
   * Send EMP destruction event for a player
   */
  empDestroyPlayer(playerId: string): void {
    const destroyMessage: ClientMessage = {
      type: 'empDestroy',
      data: {
        targetPlayerId: playerId,
        destroyerId: this.state.localPlayerId,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(destroyMessage);
  }

  /**
   * Send laser damage event for a player
   */
  laserDamagePlayer(playerId: string, damage: number): void {
    const damageMessage: ClientMessage = {
      type: 'laserDamage',
      data: {
        targetPlayerId: playerId,
        attackerId: this.state.localPlayerId,
        damage: damage,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(damageMessage);
  }

  /**
   * Send bot damage event for a bot
   */
  laserDamageBot(botId: string, damage: number): void {
    const damageMessage: ClientMessage = {
      type: 'botDamage',
      id: this.state.localPlayerId,
      data: {
        botId: botId,
        attackerId: this.state.localPlayerId,
        damage: damage,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(damageMessage);
  }

  /**
   * Send asteroid destruction event with points
   */
  asteroidDestroyed(asteroidId: string, points: number): void {
    const destroyMessage: ClientMessage = {
      type: 'asteroidDestroyed',
      id: this.state.localPlayerId,
      data: {
        asteroidId: asteroidId,
        playerId: this.state.localPlayerId,
        points: points,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(destroyMessage);
  }

  /**
   * Send shooting event to server
   */
  sendShootEvent(laserStart: Position, laserDirection: Velocity): void {
    const shootMessage: ClientMessage = {
      type: 'shoot',
      id: this.state.localPlayerId,
      data: {
        laserStart,
        laserDirection,
      },
      timestamp: Date.now(),
    };
    this.connectionManager.sendMessage(shootMessage);
  }

  /**
   * Add a remote player
   */
  addRemotePlayer(playerId: string, playerName: string): Player {
    const color = this.getPlayerColor(playerId);
    const position = this.getRemotePlayerPosition();
    const player = entityFactory.createRemotePlayer(playerId, playerName, position, color);
    this.state.players.set(playerId, player);
    console.debug('MULTIPLAYER', `Added remote player: ${playerName} (${playerId})`, {
      position,
      totalKnownPlayers: this.state.players.size,
      remoteCount: this.getRemotePlayers().length,
    });
    return player;
  }

  /**
   * Remove a player
   */
  removePlayer(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (player) {
      this.state.players.delete(playerId);
      console.debug('MULTIPLAYER', `Removed player: ${player.name} (${playerId})`, {
        totalKnownPlayers: this.state.players.size,
        remoteCount: this.getRemotePlayers().length,
      });
    }
  }

  /**
   * Update a remote player's state
   */
  updateRemotePlayer(playerId: string, update: PlayerUpdate): void {
    const player = this.state.players.get(playerId);
    if (player) {
      // Update ship state
      if (update.position) {
        player.ship.position = update.position;
      }
      if (update.velocity) {
        player.ship.velocity = update.velocity;
      }
      if (update.r !== undefined) {
        player.ship.r = update.r;
      }
      if (update.angle !== undefined) {
        player.ship.angle = update.angle;
      }
      if (update.exploding !== undefined) {
        player.ship.exploding = update.exploding;
      }
      if (update.lives !== undefined) {
        player.lives = update.lives;
      }
      if (update.health !== undefined) {
        player.ship.health = update.health;
      }
      if (update.maxHealth !== undefined) {
        player.ship.maxHealth = update.maxHealth;
      }

      // Update lasers if provided
      if (update.lasers !== undefined) {
        this.syncRemotePlayerLasers(player, update.lasers);
      }

      player.lastUpdate = Date.now();
    }
  }

  /**
   * Get all players (local + remote)
   */
  getAllPlayers(): Player[] {
    return Array.from(this.state.players.values());
  }

  /**
   * Get only remote players
   */
  getRemotePlayers(): Player[] {
    return this.getAllPlayers().filter((player) => player.type === 'remote');
  }

  /**
   * Get a specific player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.state.players.get(playerId);
  }

  /**
   * Set local player name
   */
  setLocalPlayerName(name: string): void {
    this.state.localPlayerName = name;
  }

  /**
   * Get local player name
   */
  getLocalPlayerName(): string {
    return this.state.localPlayerName;
  }

  /**
   * Get local player ID
   */
  getLocalPlayerId(): string {
    return this.state.localPlayerId;
  }

  private setupMessageHandlers(): void {
    this.connectionManager.registerMessageHandler('error', (message) => {
      console.error('MULTIPLAYER', 'Server error:', message.payload);
    });

    // Handle the "joined" message sent by server when player successfully joins
    this.connectionManager.registerMessageHandler('joined', (message) => {
      const payload = message.payload as
        | { id: string; name: string; position?: Position }
        | undefined;
      if (!payload) {
        return;
      }
      console.debug('MULTIPLAYER', 'Successfully joined game', {
        id: payload.id,
        name: payload.name,
      });
      // The server will also send a "playerJoined" message to other players
    });

    this.connectionManager.registerMessageHandler('playerJoined', (message) => {
      const payload = message.payload as PlayerJoin | undefined;
      if (!payload) {
        return;
      }
      const { id: playerId, name: playerName } = payload;
      if (playerId && playerId !== this.state.localPlayerId) {
        this.addRemotePlayer(playerId, playerName);
      }
    });

    this.connectionManager.registerMessageHandler('playerLeft', (message) => {
      const { id: playerId } = message.payload as PlayerLeave;
      this.removePlayer(playerId);
    });

    // Initial state sync from server (periodic broadcast)
    this.connectionManager.registerMessageHandler('gameState', (message) => {
      const state = message.payload as
        | { players?: Array<{ id: string; name?: string }> }
        | undefined;
      const players = state?.players ?? [];
      for (const p of players) {
        if (!p?.id) {
          continue;
        }
        if (p.id === this.state.localPlayerId) {
          continue;
        }
        if (!this.state.players.has(p.id)) {
          this.addRemotePlayer(p.id, p.name ?? `Player_${p.id.slice(0, 4)}`);
        }
      }
    });

    this.connectionManager.registerMessageHandler('playerUpdate', (message) => {
      const update = message.payload as PlayerUpdate | undefined;
      if (!update || !update.id) {
        return;
      }
      if (update.id !== this.state.localPlayerId) {
        const exists = this.state.players.has(update.id);
        if (!exists) {
          console.debug('MULTIPLAYER', 'Received update for unknown player, creating stub', {
            id: update.id,
          });
          this.addRemotePlayer(update.id, `Player_${update.id.slice(0, 4)}`);
        }
        this.updateRemotePlayer(update.id, update);
      }
    });

    this.connectionManager.registerMessageHandler('empDestroy', (message) => {
      const { targetPlayerId } = message.payload as { targetPlayerId: string };
      if (targetPlayerId !== this.state.localPlayerId) {
        // Handle EMP destruction of remote player
        this.removePlayer(targetPlayerId);
      }
    });

    this.connectionManager.registerMessageHandler('playerShoot', (message) => {
      const shootData = message.payload as {
        id: string;
        laserStart: Position;
        laserDirection: Velocity;
      };
      if (shootData.id !== this.state.localPlayerId) {
        // Handle remote player shooting event
        this.handleRemotePlayerShoot(shootData.id, shootData.laserStart, shootData.laserDirection);
      }
    });

    this.connectionManager.registerMessageHandler('playerDamaged', (message) => {
      const damageData = message.payload as {
        targetPlayerId: string;
        attackerId: string;
        damage: number;
        remainingHealth?: number;
        isDestroyed: boolean;
      };

      // Update the target player's health and state
      const targetPlayer = this.state.players.get(damageData.targetPlayerId);
      if (targetPlayer) {
        if (damageData.remainingHealth !== undefined) {
          targetPlayer.ship.health = damageData.remainingHealth;
          targetPlayer.ship.maxHealth = targetPlayer.ship.maxHealth || 100; // Ensure maxHealth is set
        }

        if (damageData.isDestroyed) {
          // Apply damage to trigger explosion if health is 0
          if (damageData.remainingHealth === 0) {
            targetPlayer.ship.takeDamage(0); // This will trigger explosion if health is 0
          } else {
            targetPlayer.ship.exploding = true;
          }
        }
      }
    });

    // Handle dedicated score updates
    this.connectionManager.registerMessageHandler('scoreUpdate', (message) => {
      const scoreData = message.payload as {
        playerId: string;
        score: number;
      };

      // Update the player's score
      const player = this.state.players.get(scoreData.playerId);
      if (player) {
        player.score = scoreData.score;
        console.debug('MULTIPLAYER', 'Score updated from server', {
          playerId: scoreData.playerId,
          newScore: scoreData.score,
        });
      }
    });
  }

  private getRemotePlayerPosition(): Position {
    const isDebugLevel = import.meta.env.VITE_CLIENT_LOG_LEVEL === 'debug';
    const shouldPlaceNearEachOther =
      isDebugLevel && import.meta.env.VITE_DEBUG_PLACE_REMOTE_PLAYERS_NEAR_EACH_OTHER === 'true';

    if (shouldPlaceNearEachOther) {
      const existingRemotePlayers = this.getRemotePlayers();

      if (existingRemotePlayers.length > 0) {
        // Place new remote player near existing remote players
        const referencePlayer =
          existingRemotePlayers[Math.floor(Math.random() * existingRemotePlayers.length)];
        return getRandomPositionNearPoint(referencePlayer.ship.position, 150);
      } else {
        // First remote player, place randomly but not at origin
        return getRandomPositionWithinBoundary();
      }
    } else {
      // Default behavior: place at origin (will be updated by server)
      return { x: 0, y: 0 };
    }
  }

  private syncRemotePlayerLasers(
    player: Player,
    lasers: Array<{
      position: Position;
      velocity: Velocity;
      distTraveled: number;
      explodeTime: number;
      hasExploded: boolean;
    }>
  ): void {
    // Create Laser instances from the received data
    const laserInstances = lasers.map((laserData) => {
      const laser = new Laser(
        laserData.position,
        laserData.velocity,
        laserData.distTraveled,
        laserData.explodeTime,
        laserData.hasExploded
      );
      return laser;
    });

    // Replace the player's lasers with the synchronized ones
    player.ship.lasers = laserInstances;
  }

  private handleRemotePlayerShoot(
    playerId: string,
    laserStart: Position,
    laserDirection: Velocity
  ): void {
    const player = this.state.players.get(playerId);
    if (player) {
      // Create a new laser for the remote player
      const laser = new Laser(laserStart, laserDirection, 0, 0, false);
      player.ship.lasers.push(laser);

      // Play laser sound for remote player (optional - might be too noisy)
      // laser.playLaserSound();
    }
  }

  private getPlayerColor(playerId: string): string {
    let color = this.state.playerColors.get(playerId);
    if (!color) {
      color = generateRandomPlayerColor();
      this.state.playerColors.set(playerId, color);
    }
    return color;
  }
}
