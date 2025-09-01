import type { Laser } from '../entities/laser/Laser';
import type { Player } from '../entities/player/Player';
import type { RoidBelt } from '../entities/roid/Roid';
import { isDebugMode } from '../utils/debugUtils';
import { logger } from '../utils/Logger';
import { getGameBoundary } from './boundary';
import {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
} from './collision/boundaryCollisions';
import { detectLaserHits, detectPlayerLaserShipCollisions } from './collision/laserCollisions';
import {
  detectAllPlayerCollisions,
  detectPlayerRoidCollisions,
  detectRoidHits,
} from './collision/shipCollisions';

export type CollisionResult = Record<string, never>;

export class CollisionManager {
  private static instance: CollisionManager;

  private constructor() {}

  static getInstance(): CollisionManager {
    if (!CollisionManager.instance) {
      CollisionManager.instance = new CollisionManager();
    }
    return CollisionManager.instance;
  }

  /**
   * Unified collision detection for all game entities
   */
  detectAllCollisions(
    localPlayer: Player,
    roidBelt: RoidBelt,
    allPlayers?: Player[]
  ): CollisionResult {
    const result: CollisionResult = {};

    // Skip all collisions if player is in respawn countdown
    if (localPlayer.respawnTimer !== undefined) {
      if (isDebugMode()) {
        logger.debug('COLLISION', 'Player has respawn timer, skipping collisions', {
          playerId: localPlayer.id,
          respawnTimer: localPlayer.respawnTimer,
        });
      }
      return result;
    }

    const ship = localPlayer.ship;

    // Detect laser hits on roids first (before boundary check to avoid losing scoring)
    detectLaserHits(roidBelt, localPlayer, allPlayers);

    // Server handles all scoring in multiplayer mode

    // Check boundary collisions
    if (detectBoundaryCollisions(ship)) {
      return result;
    }

    // Detect roid hits on ship
    detectRoidHits(ship, roidBelt);

    // Server handles all scoring in multiplayer mode

    // Stop processing if ship is now exploding (from roid collision)
    if (ship.exploding) {
      return result;
    }

    // Performance optimization: limit processing when there are too many entities
    if (this.shouldLimitCollisionChecks(roidBelt, ship, allPlayers)) {
      return result;
    }

    if (allPlayers && allPlayers.length > 0) {
      // Note: detectLaserHits already handles laser-player collisions above,
      // so we don't need to call detectLaserPlayerCollisions again to avoid duplicates

      // Detect all other player-related collisions
      detectPlayerBoundaryCollisions(localPlayer, allPlayers);

      // Stop processing if ship is now exploding (from player boundary collision)
      if (ship.exploding) {
        return result;
      }

      detectAllPlayerCollisions(localPlayer, allPlayers);

      // Stop processing if ship is now exploding (from player collision)
      if (ship.exploding) {
        return result;
      }

      detectPlayerLaserShipCollisions(localPlayer, allPlayers);

      // Stop processing if ship is now exploding (from laser collision)
      if (ship.exploding) {
        return result;
      }

      detectPlayerRoidCollisions(localPlayer, allPlayers, roidBelt);
    }

    return result;
  }

  /**
   * Check if collision processing should be limited for performance
   */
  private shouldLimitCollisionChecks(
    roidBelt: RoidBelt,
    ship: { lasers: Laser[] },
    allPlayers?: Player[]
  ): boolean {
    const roidCount = roidBelt.roids.length;
    if (roidCount > 500) {
      logger.warn('COLLISION', 'Too many roids detected, limiting collision checks', { roidCount });
      return true;
    }

    const laserCount = ship.lasers.length;
    if (laserCount > 200) {
      logger.warn('COLLISION', 'Too many lasers detected, limiting collision checks', {
        laserCount,
      });
      return true;
    }

    if (allPlayers && allPlayers.length > 50) {
      logger.warn('COLLISION', 'Too many entities detected, limiting collision checks', {
        playerCount: allPlayers.length,
      });
      return true;
    }

    return false;
  }

  /**
   * Check if a ship has boundary collision
   */
  hasBoundaryCollision(ship: { position: { x: number; y: number }; r: number }): boolean {
    // Simple boundary check without triggering explosion
    const boundary = getGameBoundary();
    const shipRadius = ship.r;
    const dx = ship.position.x - boundary.cx;
    const dy = ship.position.y - boundary.cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance + shipRadius > boundary.radius;
  }

  /**
   * Check if a player should skip collision detection
   */
  shouldSkipPlayerCollision(player: Player): boolean {
    return player.ship.blinkCount > 0 || player.spawnProtectedUntil > Date.now();
  }
}
