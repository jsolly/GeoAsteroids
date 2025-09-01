import type { Position, Velocity } from '../../shared-types';
import { RNGService } from './RNGService';
import { SHIP } from '../../src/constants';

export interface ServerBot {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  explodeTime: number; // Add explosion timer
  lives: number;
  health: number;
  maxHealth: number;
  lastUpdate: number;
}

export class BotManager {
  private bots = new Map<string, ServerBot>();
  private rng: RNGService;
  private isCreatingBots = false;

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  public createBots(count: number, bounds = { width: 2000, height: 2000 }): ServerBot[] {
    // Clear existing bots
    this.bots.clear();

    const botNames = [
      'Crimson Falcon', 'Nebula Viper', 'Quantum Ranger', 'Cosmic Specter',
      'Lunar Guardian', 'Solar Sentinel', 'Galactic Hunter', 'Star Warden',
      'Nova Enforcer', 'Meteor Striker'
    ];

    // Use a separate seed sequence for bots to avoid interference with asteroids
    const originalState = this.rng.getState();
    this.rng.setState(0x9E3779B9 + 0x12345678); // Different seed for bots

    const newBots: ServerBot[] = [];

    for (let i = 0; i < Math.min(count, botNames.length); i++) {
      const botId = `server-bot-${i}`;
      const position = this.rng.randomPosition(bounds);
      const angle = this.rng.random() * Math.PI * 2;

      const bot: ServerBot = {
        id: botId,
        name: botNames[i],
        position,
        velocity: { x: 0, y: 0 },
        angle,
        exploding: false,
        explodeTime: 0, // Initialize explosion timer
        lives: 3,
        health: 100,
        maxHealth: 100,
        lastUpdate: Date.now(),
      };

      this.bots.set(botId, bot);
      newBots.push(bot);
    }

    // Restore original RNG state
    this.rng.setState(originalState);

    return newBots;
  }

  public getBot(botId: string): ServerBot | undefined {
    return this.bots.get(botId);
  }

  public getAllBots(): ServerBot[] {
    return Array.from(this.bots.values());
  }

  public getBotCount(): number {
    return this.bots.size;
  }

  public updateBot(botId: string, updates: Partial<ServerBot>): ServerBot | undefined {
    const bot = this.bots.get(botId);
    if (!bot) {
      return undefined;
    }

    // Ignore any updates to id since it's the Map key
    const { id: ignoredId, ...allowedUpdates } = updates;

    // Validate and apply maxHealth first
    if (typeof allowedUpdates.maxHealth === 'number' && Number.isFinite(allowedUpdates.maxHealth)) {
      bot.maxHealth = Math.max(1, allowedUpdates.maxHealth);
    }

    // Validate and apply health, clamped to [0, bot.maxHealth]
    if (typeof allowedUpdates.health === 'number' && Number.isFinite(allowedUpdates.health)) {
      bot.health = Math.max(0, Math.min(bot.maxHealth, allowedUpdates.health));
    }

    // Apply other allowed properties
    const { maxHealth: ignoredMaxHealth, health: ignoredHealth, ...otherUpdates } = allowedUpdates;
    Object.assign(bot, otherUpdates);

    // Update lastUpdate timestamp
    bot.lastUpdate = Date.now();

    return bot;
  }

  public damageBot(botId: string, damage: number): ServerBot | null {
    const bot = this.bots.get(botId);
    if (!bot || bot.exploding) {
      return null;
    }

    const wasAlive = bot.health > 0;
    bot.health = Math.max(0, bot.health - damage);

    // If bot is destroyed, set exploding state
    if (bot.health <= 0 && wasAlive) {
      bot.exploding = true;
              bot.explodeTime = SHIP.EXPLODE_DURATION_FRAMES; // Set explosion timer
    }

    bot.lastUpdate = Date.now();
    return bot;
  }

  public removeBot(botId: string): ServerBot | undefined {
    const bot = this.bots.get(botId);
    if (bot) {
      this.bots.delete(botId);
    }
    return bot;
  }

  /**
   * Update explosion timers for all bots
   * Returns array of bot IDs that finished exploding and should be removed
   */
  public updateExplosions(): string[] {
    const finishedExploding: string[] = [];

    for (const [botId, bot] of this.bots) {
      if (bot.exploding && bot.explodeTime > 0) {
        bot.explodeTime--;
        if (bot.explodeTime <= 0) {
          bot.exploding = false;
          finishedExploding.push(botId);
        }
      }
    }

    return finishedExploding;
  }

  public clearBots(): void {
    this.bots.clear();
  }

  // Atomic bot creation to prevent race conditions
  public createBotsSafely(count: number, bounds = { width: 2000, height: 2000 }): ServerBot[] | null {
    if (this.isCreatingBots) {
      return null; // Already creating bots
    }

    this.isCreatingBots = true;
    try {
      if (this.bots.size === 0) {
        return this.createBots(count, bounds);
      }
      return null; // Bots already exist
    } finally {
      this.isCreatingBots = false;
    }
  }

  public isCreating(): boolean {
    return this.isCreatingBots;
  }
}
