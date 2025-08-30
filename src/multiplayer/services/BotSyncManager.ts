import type { Position } from '../../../shared-types';
import { BotManager } from '../../entities/bot/botManager';
import { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { playerFactory } from '../../entities/player/PlayerFactory';
import type { ClientMessage } from '../types';
import { ConnectionManager } from './ConnectionManager';
import { PlayerSyncManager } from './PlayerSyncManager';

export class BotSyncManager {
  private static instance: BotSyncManager;
  private botManager: BotManager;
  private connectionManager: ConnectionManager;
  private playerSyncManager: PlayerSyncManager;

  private constructor() {
    this.botManager = BotManager.getInstance();
    this.connectionManager = ConnectionManager.getInstance();
    this.playerSyncManager = PlayerSyncManager.getInstance();
    this.setupMessageHandlers();
  }

  static getInstance(): BotSyncManager {
    if (!BotSyncManager.instance) {
      BotSyncManager.instance = new BotSyncManager();
    }
    return BotSyncManager.instance;
  }

  /**
   * Initialize bots for the game
   */
  initializeBots(count: number): void {
    // If connected to server, request server-managed bots
    if (this.connectionManager.isConnected()) {
      const initMessage: ClientMessage = {
        type: 'initBots',
        id: this.playerSyncManager.getLocalPlayerId(),
        data: {
          botCount: count,
        },
        timestamp: Date.now(),
      };
      this.connectionManager.sendMessage(initMessage);
      console.debug('MULTIPLAYER', 'Requested server bots', { count });
    } else {
      // Fallback to local bots if not connected
      this.botManager.createBots(count);
      console.debug('LOCAL', 'Created local bots', { count });
    }
  }

  /**
   * Get all bots as players
   */
  getBots(): Map<string, Player> {
    return this.botManager.getBots();
  }

  /**
   * Update local player position for all bots
   */
  updateLocalPlayerForBots(localPlayerPosition: Position, isAlive: boolean): void {
    this.botManager.updateLocalPlayerPosition(localPlayerPosition, isAlive);
  }

  /**
   * Update bot states in the game loop
   */
  updateBotsInGameLoop(): void {
    this.botManager.updateBotsInGameLoop();

    // Send bot updates to server if connected
    if (this.connectionManager.isConnected()) {
      this.syncBotStates();
    }
  }

  /**
   * Handle bot EMP destruction
   */
  empDestroyBot(botId: string): void {
    // TODO: Implement EMP destruction for bots
    // this.botManager.empDestroyBot(botId);

    // Notify server of bot destruction
    if (this.connectionManager.isConnected()) {
      const destroyMessage: ClientMessage = {
        type: 'botDestroyed',
        id: this.playerSyncManager.getLocalPlayerId(),
        data: {
          botId,
          destroyerId: this.playerSyncManager.getLocalPlayerId(),
          method: 'emp',
        },
        timestamp: Date.now(),
      };
      this.connectionManager.sendMessage(destroyMessage);
    }
  }

  /**
   * Get all bot players (excluding regular players)
   */
  getBotPlayers(): Player[] {
    const allPlayers = this.playerSyncManager.getAllPlayers();
    return allPlayers.filter((player) => player.type === 'bot');
  }

  private setupMessageHandlers(): void {
    this.connectionManager.registerMessageHandler('error', (message) => {
      console.error('MULTIPLAYER', 'Server error:', message.payload);
    });

    // Handle bot updates from server
    this.connectionManager.registerMessageHandler('botUpdate', (message) => {
      const payload = message.payload as {
        botId: string;
        playerId: string;
        position: { x: number; y: number };
        velocity: { x: number; y: number };
        angle: number;
        exploding: boolean;
        lives: number;
        health?: number;
        maxHealth?: number;
        lasers?: Array<{
          position: { x: number; y: number };
          velocity: { x: number; y: number };
          distTraveled: number;
          explodeTime: number;
          hasExploded: boolean;
        }>;
      };

      // Always update server-owned bots, and update remote player-owned bots
      if (
        payload.botId &&
        (payload.playerId === 'server' ||
          payload.playerId !== this.playerSyncManager.getLocalPlayerId())
      ) {
        // Update remote/server bot state
        this.updateRemoteBotState(payload.botId, {
          position: payload.position,
          velocity: payload.velocity,
          angle: payload.angle,
          exploding: payload.exploding,
          lives: payload.lives,
          health: payload.health,
          maxHealth: payload.maxHealth,
          lasers: payload.lasers,
        });
      }
    });

    // Handle bot creation from server
    this.connectionManager.registerMessageHandler('botCreated', (message) => {
      const payload = message.payload as {
        botId: string;
        botName: string;
        position: { x: number; y: number };
      };

      if (payload.botId && payload.botName) {
        // Create remote bot
        this.createRemoteBot(payload.botId, payload.botName, payload.position);
      }
    });

    // Handle bot destruction from server
    this.connectionManager.registerMessageHandler('botDestroyed', (message) => {
      const { botId } = message.payload as { botId: string };
      if (botId) {
        // Remove remote bot
        this.removeRemoteBot(botId);
      }
    });

    // Handle bot initialization from server
    this.connectionManager.registerMessageHandler('botInitialized', (message) => {
      const payload = message.payload as {
        playerId: string;
        botCount: number;
      };

      if (payload.playerId && payload.botCount !== undefined) {
        console.debug('MULTIPLAYER', 'Player initialized bots', {
          playerId: payload.playerId,
          botCount: payload.botCount,
        });
        // No action needed on client - just informational
      }
    });
  }

  private syncBotStates(): void {
    const bots = this.botManager.getBots();
    const localPlayerId = this.playerSyncManager.getLocalPlayerId();

    // Send updates for all bots controlled by this client (excluding server bots)
    for (const [botId, bot] of bots) {
      // Only sync bots that this client controls (not server-owned bots)
      if (this.isLocalBot(botId)) {
        const lasers = bot.ship.lasers.map((laser) => ({
          position: laser.position,
          velocity: laser.velocity,
          distTraveled: laser.distTraveled,
          explodeTime: laser.explodeTime,
          hasExploded: laser.hasExploded,
        }));

        const updateMessage: ClientMessage = {
          type: 'botUpdate',
          id: localPlayerId,
          data: {
            botId,
            playerId: localPlayerId,
            position: bot.ship.position,
            velocity: bot.ship.velocity,
            angle: bot.ship.angle,
            exploding: bot.ship.exploding,
            lives: bot.lives,
            health: bot.ship.health,
            maxHealth: bot.ship.maxHealth,
            lasers: lasers,
          },
          timestamp: Date.now(),
        };
        this.connectionManager.sendMessage(updateMessage);
      }
    }
  }

  private isLocalBot(botId: string): boolean {
    // Server-owned bots are not local
    if (botId.startsWith('server-bot-')) {
      return false;
    }
    // For local bots, assume ownership if not connected or if ID starts with 'local'
    return !this.connectionManager.isConnected() || botId.startsWith('local');
  }

  private updateRemoteBotState(
    botId: string,
    state: {
      position: { x: number; y: number };
      velocity: { x: number; y: number };
      angle: number;
      exploding: boolean;
      lives: number;
      health?: number;
      maxHealth?: number;
      lasers?: Array<{
        position: { x: number; y: number };
        velocity: { x: number; y: number };
        distTraveled: number;
        explodeTime: number;
        hasExploded: boolean;
      }>;
    }
  ): void {
    const bot = this.botManager.getBots().get(botId);
    if (bot) {
      // Update bot ship state
      bot.ship.position = state.position;
      bot.ship.velocity = state.velocity;
      bot.ship.angle = state.angle;
      bot.ship.exploding = state.exploding;
      bot.lives = state.lives;

      // Update health if provided
      if (state.health !== undefined) {
        bot.ship.health = state.health;
      }
      if (state.maxHealth !== undefined) {
        bot.ship.maxHealth = state.maxHealth;
      }

      // Update lasers if provided - properly manage laser lifecycle to prevent leaks
      if (state.lasers) {
        // Clear existing lasers to prevent memory leaks
        // Note: We don't call any cleanup methods since Laser class doesn't have explicit cleanup
        bot.ship.lasers.length = 0;

        // Create new Laser instances from the received data
        for (const laserData of state.lasers) {
          const laser = new Laser(
            laserData.position,
            laserData.velocity,
            laserData.distTraveled,
            laserData.explodeTime,
            laserData.hasExploded
          );
          bot.ship.lasers.push(laser);
        }
      } else if (state.lasers === null || state.lasers === undefined) {
        // If server explicitly sends empty/null lasers, clear them
        bot.ship.lasers.length = 0;
      }
    }
  }

  private createRemoteBot(
    botId: string,
    botName: string,
    position: { x: number; y: number }
  ): void {
    // Check if bot already exists
    const existingBots = this.botManager.getBots();
    if (existingBots.has(botId)) {
      console.debug('MULTIPLAYER', 'Bot already exists, skipping creation', { botId });
      return;
    }

    // Create a server-owned bot using PlayerFactory
    const botPlayer = playerFactory.createBotPlayer(botName, position);
    botPlayer.id = botId; // Override the UUID with server-provided ID
    botPlayer.type = 'bot'; // Ensure it's marked as a bot

    // Add to bot manager
    existingBots.set(botId, botPlayer);

    console.debug('MULTIPLAYER', 'Server bot created locally', {
      botId,
      botName,
      position,
      totalBots: existingBots.size,
    });
  }

  private removeRemoteBot(botId: string): void {
    // Remove bot from local manager
    const bots = this.botManager.getBots();
    if (bots.has(botId)) {
      bots.delete(botId);
      console.debug('MULTIPLAYER', 'Remote bot removed', botId);
    }
  }
}
