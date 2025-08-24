import type { Position } from '../../../shared-types';
import type { Player } from '../player/Player';
import { isBot } from '../player/playerKinds';
import type { Roid } from '../roid/Roid';
import { BotBehavior } from './BotBehavior';
import { BotFactory } from './botFactory';

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, Player> = new Map();
  private localPlayerId: string;
  public localPlayerPosition: Position = { x: 0, y: 0 };
  public localPlayerAlive: boolean = true;

  private roids: Roid[] = [];
  private otherPlayers: Player[] = [];

  // Unified bot behavior system
  private botBehavior: BotBehavior;
  private botFactory: BotFactory;

  private constructor() {
    this.localPlayerId = 'local-player';
    this.botBehavior = new BotBehavior();
    this.botFactory = new BotFactory();
  }

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  public getBots(): Map<string, Player> {
    return this.bots;
  }

  // Legacy compatibility - redirect to botBehaviorSystem
  public get botMovementSystem(): BotBehavior {
    return this.botBehavior;
  }

  public setLocalPlayerInfo(id: string, position: Position, alive: boolean): void {
    this.localPlayerId = id;
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update bot behavior system
    this.botBehavior.setLocalPlayerInfo(this.localPlayerId, position, alive);
  }

  public createBots(count: number): void {
    // Clear existing bots
    this.bots.clear();
    this.botBehavior.clearAllSteering();

    // Create new bots using factory
    const newBots = this.botFactory.createBots(count);

    // Initialize steering for each bot
    for (const [botId, bot] of newBots.entries()) {
      if (isBot(bot)) {
        this.botBehavior.initializeBotSteering(botId);
      }
    }

    this.bots = newBots;
  }

  // Public method to update local player position (called from game loop)
  public updateLocalPlayerPosition(position: Position, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update bot behavior system
    this.botBehavior.setLocalPlayerInfo(this.localPlayerId, position, alive);
  }

  public updateBotsInGameLoop(): void {
    // Only run if there are bots to update
    if (this.bots.size === 0) {
      return;
    }

    // Only bot-specific behavior (movement, shooting decisions)
    this.updateBotBehavior();
    this.botBehavior.updateBotShooting(this.bots);
  }

  public setRoids(roids: Roid[]): void {
    this.roids = roids;
  }

  public setOtherPlayers(players: Player[]): void {
    this.otherPlayers = players;
  }

  private updateBotBehavior(): void {
    for (const [, bot] of this.bots.entries()) {
      // Skip bots that are exploding
      if (bot.ship.exploding) {
        continue;
      }

      // Move bot based on behavior
      this.botBehavior.moveBot(bot, this.roids, this.otherPlayers);

      // Apply ship movement to update position based on velocity
      bot.ship.move();

      // Update timestamp
      bot.lastUpdate = Date.now();
    }
  }
}
