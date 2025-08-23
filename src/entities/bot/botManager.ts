import { SHIP_RESPAWN_DELAY_FRAMES } from '../../constants/entities/ship';
import { getGameBoundary } from '../../physics/boundary';
import type { Asteroid } from '../asteroid/Asteroid';
import type { Player } from '../player/Player';
import type { Player as PlayerInterface, Position } from '../player/types';

import { BotBehavior } from './BotBehavior';
import { BotPlayer } from './BotPlayer';
import { BotFactory } from './botFactory';

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, Player> = new Map();
  private localPlayerId: string;
  public localPlayerPosition: Position = { x: 0, y: 0 };
  public localPlayerAlive: boolean = true;
  public isActive: boolean = false;
  private asteroids: Asteroid[] = [];
  private otherPlayers: PlayerInterface[] = [];

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

  public activate(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public createBots(count: number): void {
    if (!this.isActive) {
      return;
    }

    // Clear existing bots
    this.bots.clear();
    this.botBehavior.clearAllSteering();

    // Create new bots using factory
    const newBots = this.botFactory.createBots(count);

    // Initialize steering for each bot
    for (const [botId, bot] of newBots.entries()) {
      if (bot instanceof BotPlayer) {
        this.botBehavior.initializeBotSteering(botId, 'aggressive'); // Default type
      }
    }

    this.bots = newBots;
  }

  public clearBots(): void {
    this.botBehavior.clearBotLasers(this.bots);
    this.bots.clear();
    this.botBehavior.clearAllSteering();
  }

  public resetDebugFlags(): void {
    this.botBehavior.debugMovementDisabled = false;
  }

  public clearBotLasers(): void {
    this.botBehavior.clearBotLasers(this.bots);
  }

  // Legacy compatibility method
  public botTakeDamage(bot: PlayerInterface, amount: number): void {
    if (bot instanceof BotPlayer) {
      bot.ship.takeDamage(amount);
    }
  }

  // Public method to update local player position (called from game loop)
  public updateLocalPlayerPosition(position: Position, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update bot behavior system
    this.botBehavior.setLocalPlayerInfo(this.localPlayerId, position, alive);
  }

  public updateBotsInGameLoop(): void {
    if (!this.isActive) {
      return;
    }

    // Update bot behavior and movement
    this.updateBotBehavior();

    // Update bot shooting
    this.botBehavior.updateBotShooting(this.bots);

    // Update bot explosions and handle respawning
    for (const bot of this.bots.values()) {
      if (bot.ship.exploding) {
        // Start a respawn timer when explosion starts
        if (bot.respawnTimer === undefined && bot.ship.explodeTime > 0) {
          bot.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;

          // Generate random respawn position within the game boundary
          const boundary = getGameBoundary();
          const margin = 100; // Keep bots away from the very edge
          const randomX = boundary.x + margin + Math.random() * (boundary.width - 2 * margin);
          const randomY = boundary.y + margin + Math.random() * (boundary.height - 2 * margin);
          bot.respawnPosition = { x: randomX, y: randomY };

          // Log bot explosion for debugging
          import('../../physics/collision/collisionUtils').then(({ logCollisionDetection }) => {
            logCollisionDetection('Bot Exploded', bot.name, 'Collision', true);
          });
        }

        bot.ship.updateExplosion();
        continue;
      }

      // If a respawn timer is active, count down and respawn when it reaches zero
      if (bot.respawnTimer !== undefined) {
        if (bot.respawnTimer > 0) {
          bot.respawnTimer--;
        }

        if (bot.respawnTimer === 0) {
          // Log bot respawn for debugging
          import('../../physics/collision/collisionUtils').then(({ logCollisionDetection }) => {
            logCollisionDetection('Bot Respawning', bot.name, 'Respawn', false);
          });

          bot.respawn();
          bot.respawnTimer = undefined;
        }
      }
    }

    // Update bot lasers
    this.botBehavior.updateBotLasers(this.bots);

    // Update bot invincibility and health using Ship's built-in methods
    for (const bot of this.bots.values()) {
      if (!bot.ship.exploding) {
        bot.ship.updateInvincibility();
        bot.ship.updateHealth();
      }
    }
  }

  public setAsteroids(asteroids: Asteroid[]): void {
    this.asteroids = asteroids;
  }

  public setOtherPlayers(players: PlayerInterface[]): void {
    this.otherPlayers = players;
  }

  private updateBotBehavior(): void {
    for (const [, bot] of this.bots.entries()) {
      // Skip bots that are exploding
      if (bot.ship.exploding) {
        continue;
      }

      // Move bot based on behavior
      this.botBehavior.moveBot(bot, this.asteroids, this.otherPlayers);

      // Apply ship movement to update position based on velocity
      bot.ship.move();

      // Update timestamp
      bot.lastUpdate = Date.now();
    }
  }
}
