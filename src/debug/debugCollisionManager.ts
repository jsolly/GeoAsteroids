import type { AsteroidBelt } from '../entities/asteroid/Asteroid';
import type { BotPlayer } from '../entities/bot/types';
import { getDebugConfig } from './debugConfig';

/**
 * Debug collision manager that provides debug-specific collision behavior
 * without polluting the main collision detection code.
 */
export class DebugCollisionManager {
  private static instance: DebugCollisionManager;
  private debugConfig: ReturnType<typeof getDebugConfig>;

  private constructor() {
    this.debugConfig = getDebugConfig();
  }

  static getInstance(): DebugCollisionManager {
    if (!DebugCollisionManager.instance) {
      DebugCollisionManager.instance = new DebugCollisionManager();
    }
    return DebugCollisionManager.instance;
  }

  /**
   * Checks if a bot should be considered invincible for collision detection
   * based on debug settings.
   */
  shouldSkipBotCollision(bot: BotPlayer): boolean {
    // If debug mode disables spawn protection, ignore invincibility
    if (this.debugConfig.disableBotSpawnProtection) {
      return false; // Don't skip collision
    }

    // Normal invincibility check
    return bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now();
  }

  /**
   * Logs debug information about bot collision detection
   */
  logBotCollisionDebug(
    bot: BotPlayer,
    collisionType: string,
    details?: Record<string, unknown>
  ): void {
    if (!this.debugConfig.disableBotSpawnProtection) {
      return; // Only log when this debug feature is enabled
    }

    console.debug('DEBUG_COLLISION', `Bot ${collisionType}`, {
      botId: bot.id,
      botType: bot.botType,
      position: { x: bot.ship.position.x, y: bot.ship.position.y },
      health: bot.ship.health,
      blinkCount: bot.ship.blinkCount,
      spawnProtectedUntil: bot.spawnProtectedUntil,
      exploding: bot.ship.exploding,
      disableSpawnProtection: this.debugConfig.disableBotSpawnProtection,
      ...details,
    });
  }

  /**
   * Logs debug information about asteroid placement and collision testing
   */
  logAsteroidPlacementDebug(asteroidBelt: AsteroidBelt, bots: Map<string, BotPlayer>): void {
    if (!this.debugConfig.placeAsteroidOnBot) {
      return;
    }

    console.info('DEBUG_ASTEROID_PLACEMENT', 'Asteroid collision testing setup', {
      asteroidCount: asteroidBelt.roids.length,
      botCount: bots.size,
      disableBotSpawnProtection: this.debugConfig.disableBotSpawnProtection,
      timestamp: Date.now(),
    });
  }
}
