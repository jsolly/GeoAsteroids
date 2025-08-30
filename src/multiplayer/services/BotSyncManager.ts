import type { Position } from '../../../shared-types';
import { BotManager } from '../../entities/bot/botManager';
import type { Player } from '../../entities/player/Player';
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
    this.botManager.createBots(count);

    // Send bot initialization info to server if connected
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
      const {
        botId: _botId,
        position: _position,
        velocity: _velocity,
        angle: _angle,
        exploding: _exploding,
      } = message.payload as {
        botId: string;
        position: { x: number; y: number };
        velocity: { x: number; y: number };
        angle: number;
        exploding: boolean;
      };
      // TODO: Implement bot state updates
      // this.botManager.updateBotState(botId, {
      //   position,
      //   velocity,
      //   angle,
      //   exploding,
      // });
    });

    // Handle bot creation from server
    this.connectionManager.registerMessageHandler('botCreated', (message) => {
      const {
        botId: _botId,
        botName: _botName,
        position: _position,
      } = message.payload as {
        botId: string;
        botName: string;
        position: { x: number; y: number };
      };
      // TODO: Implement individual bot creation
      // this.botManager.createBot(botId, botName, position);
    });

    // Handle bot destruction from server
    this.connectionManager.registerMessageHandler('botDestroyed', (message) => {
      const { botId: _botId } = message.payload as { botId: string };
      // TODO: Implement bot removal
      // this.botManager.removeBot(botId);
    });
  }

  private syncBotStates(): void {
    const bots = this.botManager.getBots();
    const localPlayerId = this.playerSyncManager.getLocalPlayerId();

    // Send updates for all bots controlled by this client
    for (const [botId, bot] of bots) {
      // Only sync bots that this client controls (could be based on ownership)
      if (this.isLocalBot(botId)) {
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
          },
          timestamp: Date.now(),
        };
        this.connectionManager.sendMessage(updateMessage);
      }
    }
  }

  private isLocalBot(botId: string): boolean {
    // Simple ownership logic - could be enhanced with proper ownership tracking
    // For now, assume all bots are local if not connected to a server
    return !this.connectionManager.isConnected() || botId.startsWith('local');
  }
}
