import type { Laser } from '../entities/laser/Laser';
import type { Player } from '../entities/player/Player';
import type { RoidBelt } from '../entities/roid/Roid';
import { getGameBoundary } from './boundary';
import {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
} from './collision/boundaryCollisions';
import {
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerLaserShipCollisions,
} from './collision/laserCollisions';
import {
  detectAllPlayerCollisions,
  detectPlayerRoidCollisions,
  detectRoidHits,
} from './collision/shipCollisions';

export interface CollisionResult {
  laserScore: number;
  roidScore: number;
  playerCollisionScore: number;
}

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
    const result: CollisionResult = {
      laserScore: 0,
      roidScore: 0,
      playerCollisionScore: 0,
    };

    // Skip all collisions if player is in respawn countdown
    if (localPlayer.respawnTimer !== undefined) {
      console.debug(
        `[CollisionManager] Player ${localPlayer.id} has respawn timer (${localPlayer.respawnTimer} frames), skipping collisions`
      );
      return result;
    }

    const ship = localPlayer.ship;

    // Check boundary collisions first
    if (detectBoundaryCollisions(ship)) {
      return result;
    }

    // Detect laser hits on roids
    result.laserScore = detectLaserHits(roidBelt, localPlayer, allPlayers);

    // Detect roid hits on ship
    result.roidScore = detectRoidHits(ship, roidBelt);

    // Update player's individual score for leaderboard
    if (result.laserScore > 0 || result.roidScore > 0) {
      localPlayer.score += result.laserScore + result.roidScore;
    }

    // Performance optimization: limit processing when there are too many entities
    if (this.shouldLimitCollisionChecks(roidBelt, ship, allPlayers)) {
      return result;
    }

    if (allPlayers && allPlayers.length > 0) {
      // Detect laser player collisions
      result.playerCollisionScore = detectLaserPlayerCollisions(localPlayer, allPlayers);

      if (result.playerCollisionScore > 0) {
        localPlayer.score += result.playerCollisionScore;
      }

      // Detect all other player-related collisions
      detectPlayerBoundaryCollisions(localPlayer, allPlayers);
      detectAllPlayerCollisions(localPlayer, allPlayers);
      detectPlayerLaserShipCollisions(localPlayer, allPlayers);
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
      console.warn(
        `Too many roids detected: ${roidCount}. Limiting collision checks to prevent slowdown.`
      );
      return true;
    }

    const laserCount = ship.lasers.length;
    if (laserCount > 200) {
      console.warn(
        `Too many lasers detected: ${laserCount}. Limiting collision checks to prevent slowdown.`
      );
      return true;
    }

    if (allPlayers && allPlayers.length > 50) {
      console.warn(
        `Too many entities detected: ${allPlayers.length}. Limiting collision checks to prevent slowdown.`
      );
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
