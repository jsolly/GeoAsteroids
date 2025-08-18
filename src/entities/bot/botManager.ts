import { v4 as uuidv4 } from 'uuid';
import { Vector } from '../../physics/Vector.ts';
import type { Laser } from '../ship/Ship.ts';
import { BotCombat } from './botCombat.ts';
import { BotFactory } from './botFactory.ts';
import { BotMovement } from './botMovement.ts';
import { BotState } from './botState.ts';
import type { BotBullet, BotPlayer, BotShoot } from './types.ts';

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, BotPlayer> = new Map();
  private localPlayerId: string;
  public localPlayerPosition: Vector = new Vector(0, 0);
  public localPlayerAlive: boolean = true;
  public isActive: boolean = false;

  // Modular components
  private botMovement: BotMovement;
  private botCombat: BotCombat;
  private botState: BotState;
  private botFactory: BotFactory;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.botMovement = new BotMovement();
    this.botCombat = new BotCombat();
    this.botState = new BotState();
    this.botFactory = new BotFactory();
  }

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  public setLocalPlayerInfo(id: string, position: Vector, alive: boolean): void {
    this.localPlayerId = id;
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update all modular components
    this.botMovement.setLocalPlayerInfo(position, alive);
    this.botCombat.setLocalPlayerInfo(id, position, alive);
  }

  public setBotShootCallback(callback: (botShoot: BotShoot) => void): void {
    this.botCombat.setBotShootCallback(callback);
  }

  public activate(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    console.info('BOT_MANAGER', 'Bot behavior loop started - integrated with main game loop');
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public createBots(count: number = 3): void {
    if (!this.isActive) {
      return;
    }

    console.info('BOT_MANAGER', 'Creating bots', {
      count,
      isActive: this.isActive,
    });

    // Clear existing bots
    this.bots.clear();
    this.botMovement.clearAllSteering();

    // Create new bots using factory
    const newBots = this.botFactory.createBots(count);

    // Initialize steering for each bot
    for (const [botId, bot] of newBots.entries()) {
      this.botMovement.initializeBotSteering(botId, bot.botType);
    }

    this.bots = newBots;

    console.info('BOT_MANAGER', 'Finished creating bots', {
      totalBots: this.bots.size,
      botIds: Array.from(this.bots.keys()),
    });
  }

  public getBots(): Map<string, BotPlayer> {
    return this.bots;
  }

  public getBotBullets(): Map<string, BotBullet> {
    return this.botCombat.getBotBullets();
  }

  public getBotLasers(): Map<string, Laser[]> {
    return this.botCombat.getBotLasers();
  }

  // Compatibility shim for legacy tests and tooling
  public createBotBullet(botShoot: BotShoot): void {
    this.botCombat.createBotBullet(botShoot);
  }

  public createBotLaser(botShoot: BotShoot): void {
    this.botCombat.createBotLaser(botShoot);
  }

  public updateBotBullets(): void {
    this.botCombat.updateBotBullets();
  }

  public updateBotLasers(): void {
    this.botCombat.updateBotLasers();
  }

  public removeBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      console.info('BOT_MANAGER', 'Removing bot', { botId, name: bot.name });
      this.bots.delete(botId);
      this.botMovement.removeBotSteering(botId);
    }
  }

  public clearBots(): void {
    this.bots.clear();
    this.botCombat.clearBotBullets();
    this.botCombat.clearBotLasers();
    this.botMovement.clearAllSteering();
    console.info('BOT_MANAGER', 'All bots and bullets cleared');
  }

  public clearBotBullets(): void {
    this.botCombat.clearBotBullets();
  }

  public clearBotLasers(): void {
    this.botCombat.clearBotLasers();
  }

  // Handle bot explosion and cleanup
  public handleBotExplosion(botId: string): void {
    this.botState.handleBotExplosion(botId, this.bots);
  }

  // Method for EMP destruction that triggers respawn system
  public empDestroyBot(botId: string): void {
    this.botState.empDestroyBot(botId, this.bots);
  }

  public botTakeDamage(bot: BotPlayer, amount: number): void {
    this.botState.botTakeDamage(bot, amount);
  }

  // Public method to update local player position (called from game loop)
  public updateLocalPlayerPosition(position: Vector, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update all modular components
    this.botMovement.setLocalPlayerInfo(position, alive);
    this.botCombat.setLocalPlayerInfo(this.localPlayerId, position, alive);

    // Log position updates (occasionally to avoid spam)
    if (Math.random() < 0.05) {
      console.info('BOT_MANAGER', 'Local player position updated', {
        position: { x: Math.round(position.x), y: Math.round(position.y) },
        alive,
        botCount: this.bots.size,
        activeBots: Array.from(this.bots.values()).filter((bot) => !bot.ship.exploding).length,
      });
    }
  }

  public updateBotsInGameLoop(): void {
    if (!this.isActive) {
      return;
    }

    // Update bot behavior and movement
    this.updateBotBehavior();

    // Update bot shooting
    this.botCombat.updateBotShooting(this.bots);

    // Update bot explosions
    this.botState.updateBotExplosions(this.bots);

    // Update bot bullets
    this.botCombat.updateBotLasers();

    // Update bot invincibility and blinking effects
    for (const bot of this.bots.values()) {
      if (!bot.ship.exploding) {
        this.botState.updateBotInvincibility(bot);
        this.botState.updateBotHealth(bot);
      }
    }

    // Log framerate synchronization and bot status (occasionally)
    if (Math.random() < 0.01) {
      const activeBots = Array.from(this.bots.values()).filter((bot) => !bot.ship.exploding);
      console.info('BOT_FRAMERATE', 'Bot update synchronized with main game loop', {
        botCount: this.bots.size,
        activeBots: activeBots.length,
        localPlayerAlive: this.localPlayerAlive,
        localPlayerPosition: this.localPlayerAlive
          ? {
              x: Math.round(this.localPlayerPosition.x),
              y: Math.round(this.localPlayerPosition.y),
            }
          : 'unknown',
        botStates: activeBots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          behavior: bot.behaviorState,
          position: {
            x: Math.round(bot.ship.position.x),
            y: Math.round(bot.ship.position.y),
          },
        })),
      });
    }
  }

  private updateBotBehavior(): void {
    const now = Date.now();

    for (const [, bot] of this.bots.entries()) {
      // Skip bots that are exploding
      if (bot.ship.exploding) {
        continue;
      }

      // Update behavior state less frequently to reduce flickering
      if (now - bot.lastBehaviorChange > 5000 + Math.random() * 8000) {
        this.updateBotBehaviorState(bot);
      }

      // Move bot based on behavior
      this.botMovement.moveBot(bot);

      // Update timestamp
      bot.lastUpdate = now;
    }
  }

  private updateBotBehaviorState(bot: BotPlayer): void {
    const now = Date.now();

    // Always hunt - no evading, no patrolling
    bot.behaviorState = 'hunting';

    bot.lastBehaviorChange = now;
  }
}
