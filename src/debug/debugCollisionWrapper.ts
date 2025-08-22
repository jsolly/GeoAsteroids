import type { AsteroidBelt } from '../entities/asteroid/Asteroid.ts';
import type { BotPlayer } from '../entities/bot/types.ts';
import { DebugCollisionManager } from './debugCollisionManager.ts';

/**
 * Debug collision wrapper that provides debug-enhanced collision detection
 * while keeping the main collision code clean.
 */
export class DebugCollisionWrapper {
  private static instance: DebugCollisionWrapper;
  private debugManager: DebugCollisionManager;

  private constructor() {
    this.debugManager = DebugCollisionManager.getInstance();
  }

  static getInstance(): DebugCollisionWrapper {
    if (!DebugCollisionWrapper.instance) {
      DebugCollisionWrapper.instance = new DebugCollisionWrapper();
    }
    return DebugCollisionWrapper.instance;
  }

  /**
   * Debug-enhanced version of bot-asteroid collision detection
   * that respects debug settings for spawn protection.
   */
  detectBotAsteroidCollisions(bots: Map<string, BotPlayer>, asteroidBelt: AsteroidBelt): void {
    // Log debug information about the collision testing setup
    this.debugManager.logAsteroidPlacementDebug(asteroidBelt, bots);

    if (!bots || bots.size === 0) {
      return;
    }

    const roids = asteroidBelt.roids;
    if (roids.length === 0) {
      return;
    }

    // Check each bot for asteroid collisions
    for (const [botId, bot] of bots.entries()) {
      // Skip exploding bots
      if (bot.ship.exploding) {
        continue;
      }

      // Use debug manager to determine if bot should be skipped
      if (this.debugManager.shouldSkipBotCollision(bot)) {
        this.debugManager.logBotCollisionDebug(bot, 'skipped (invincible)');
        continue;
      }

      // Log that we're checking this bot for collisions
      this.debugManager.logBotCollisionDebug(bot, 'checking for collisions');

      // Check collision with each asteroid
      for (let i = 0; i < roids.length; i++) {
        const distance = bot.ship.position.distance(roids[i].position);
        const collisionThreshold = bot.ship.r + roids[i].r;

        if (distance < collisionThreshold) {
          this.debugManager.logBotCollisionDebug(bot, 'collision detected', {
            distance,
            collisionThreshold,
            asteroidRadius: roids[i].r,
            botRadius: bot.ship.r,
            botHealthBefore: bot.ship.health,
          });

          // Handle the collision (this would call the actual collision logic)
          // For now, we'll just log the collision since this is a debug wrapper
          console.info('DEBUG_COLLISION', 'Bot-asteroid collision would occur', {
            botId,
            botType: bot.botType,
            asteroidIndex: i,
            distance,
            collisionThreshold,
          });

          // Only handle one collision per bot to avoid multiple simultaneous destructions
          break;
        }
      }
    }
  }
}
