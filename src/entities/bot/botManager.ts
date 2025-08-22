import { v4 as uuidv4 } from 'uuid';
import { SHIP_RESPAWN_DELAY_FRAMES } from '../../constants';
import { Vector } from '../../physics/Vector.ts';
import type { Laser } from '../ship/Ship.ts';
import { BotCombat } from './botCombat.ts';
import { BotFactory } from './botFactory.ts';
import { BotMovement } from './botMovement.ts';
import type { BotPlayer, BotShoot } from './types.ts';

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
  private botFactory: BotFactory;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.botMovement = new BotMovement();
    this.botCombat = new BotCombat();
    this.botFactory = new BotFactory();
  }

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  // For testing purposes - reset the singleton instance
  public static resetInstance(): void {
    if (BotManager.instance) {
      BotManager.instance.isActive = false;
      BotManager.instance.clearBots();
      BotManager.instance.localPlayerId = '';
      BotManager.instance.localPlayerPosition = new Vector(0, 0);
      BotManager.instance.localPlayerAlive = true;
    }
    (BotManager as any).instance = undefined;
  }

  public getBots(): Map<string, BotPlayer> {
    return this.bots;
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
    this.botMovement.clearAllSteering();

    // Create new bots using factory
    const newBots = this.botFactory.createBots(count);

    // Initialize steering for each bot
    for (const [botId, bot] of newBots.entries()) {
      this.botMovement.initializeBotSteering(botId, bot.botType);
    }

    this.bots = newBots;
  }

  public getBotLasers(): Map<string, Laser[]> {
    return this.botCombat.getBotLasers();
  }

  public createBotLaser(botShoot: BotShoot): void {
    this.botCombat.createBotLaser(botShoot);
  }

  public updateBotLasers(): void {
    this.botCombat.updateBotLasers();
  }

  public removeBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      this.bots.delete(botId);
      this.botMovement.removeBotSteering(botId);
    }
  }

  public clearBots(): void {
    this.bots.clear();
    this.botCombat.clearBotLasers();
    this.botMovement.clearAllSteering();
  }

  public clearBotLasers(): void {
    this.botCombat.clearBotLasers();
  }

  // Handle bot explosion and cleanup
  public handleBotExplosion(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) {
      return;
    }

    // Use Ship's built-in explosion method and set exploding state
    bot.ship.explode();
    bot.ship.setExploding();

    // Initialize respawn timer when explosion starts
    if (bot.respawnTimer === undefined) {
      bot.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;
      bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
    }
  }

  // Method for EMP destruction that triggers respawn system
  public empDestroyBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) {
      return;
    }

    // Use Ship's built-in explosion method and set exploding state
    bot.ship.explode();
    bot.ship.setExploding();

    // Initialize respawn timer when explosion starts
    if (bot.respawnTimer === undefined) {
      bot.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;
      bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
    }
  }

  public botTakeDamage(bot: BotPlayer, amount: number): void {
    // Use BotPlayer's custom damage method (explosion without life loss)
    bot.takeDamage(amount);
  }

  // Public method to update local player position (called from game loop)
  public updateLocalPlayerPosition(position: Vector, alive: boolean): void {
    this.localPlayerPosition = position;
    this.localPlayerAlive = alive;

    // Update all modular components
    this.botMovement.setLocalPlayerInfo(position, alive);
    this.botCombat.setLocalPlayerInfo(this.localPlayerId, position, alive);
  }

  public updateBotsInGameLoop(): void {
    if (!this.isActive) {
      return;
    }

    // Update bot behavior and movement
    this.updateBotBehavior();

    // Update bot shooting
    this.botCombat.updateBotShooting(this.bots);

    // Update bot explosions and handle respawning with a timer to avoid repeated respawns
    for (const bot of this.bots.values()) {
      if (bot.ship.exploding) {
        // Start a respawn timer when explosion starts
        if (bot.respawnTimer === undefined && bot.ship.explodeTime > 0) {
          bot.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;
          bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
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
          bot.respawn();
          bot.respawnTimer = undefined;

          // Add bot-specific respawn behavior
          bot.behaviorState = 'hunting';
          bot.lastBehaviorChange = Date.now();
          bot.score = Math.floor(Math.random() * 2000);
        }
      }
    }

    // Update bot lasers
    this.botCombat.updateBotLasers();

    // Update bot invincibility and health using Ship's built-in methods
    for (const bot of this.bots.values()) {
      if (!bot.ship.exploding) {
        const healthBefore = bot.ship.health;
        const lastDamageTimeBefore = bot.ship.lastDamageTime;
        const healthRegenTimerBefore = bot.ship.healthRegenTimer;

        bot.ship.updateInvincibility();
        bot.ship.updateHealth();

        // Log health changes for debugging
        if (
          healthBefore !== bot.ship.health ||
          lastDamageTimeBefore !== bot.ship.lastDamageTime ||
          healthRegenTimerBefore !== bot.ship.healthRegenTimer
        ) {
          console.debug('BOT_HEALTH_DEBUG', 'Bot health state updated', {
            botId: bot.id,
            botType: bot.botType,
            healthBefore,
            healthAfter: bot.ship.health,
            lastDamageTimeBefore,
            lastDamageTimeAfter: bot.ship.lastDamageTime,
            healthRegenTimerBefore,
            healthRegenTimerAfter: bot.ship.healthRegenTimer,
            exploding: bot.ship.exploding,
          });
        }
      }
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
