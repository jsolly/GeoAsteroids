import { DAMAGE } from '../../constants';
import type { Laser } from '../../entities/laser/Laser';
import type { CollisionActor } from '../../entities/player/playerTypes';
import type { Roid } from '../../entities/roid/Roid';
import { getAsteroidPoints } from '../../entities/roid/roidPoints';
import type { Ship } from '../../entities/ship/Ship';
import { isShipCollisionImmune } from '../../entities/ship/shipUtils';
import { NetworkManager } from '../../network/networkManager';
import { logger } from '../../utils/Logger';
import {
  checkBoundaryCollision,
  checkLaserAsteroidCollision,
  checkLaserShipCollision,
  checkShipCollision,
} from './collisionDetection';

export class CollisionManager {
  private static instance: CollisionManager;
  private networkManager: NetworkManager;

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
  }

  static getInstance(): CollisionManager {
    if (!CollisionManager.instance) {
      CollisionManager.instance = new CollisionManager();
    }
    return CollisionManager.instance;
  }

  /**
   * Check boundary collisions for ships
   */
  checkBoundaryCollisions(ships: Ship[], localPlayerId: string): void {
    logger.debug('COLLISION', 'Checking boundary collisions', {
      shipCount: ships.length,
      localPlayerId,
    });

    for (const ship of ships) {
      // Same immunity as asteroid / ship-ship: exploding, dead, or blinking.
      // Boundary previously skipped only exploding, so a dead or freshly
      // respawned hull kept sending 100-damage collisionDamage at 60 Hz.
      if (isShipCollisionImmune(ship)) {
        logger.debug('COLLISION', 'Skipping immune ship for boundary', { shipId: ship.id });
        continue;
      }

      // Check if ship is outside the boundary
      const isOutsideBoundary = checkBoundaryCollision(ship.position, ship.r);
      logger.debug('COLLISION', 'Boundary collision check', {
        shipId: ship.id,
        shipPosition: ship.position,
        shipRadius: ship.r,
        isOutsideBoundary,
      });

      if (isOutsideBoundary) {
        this.handleBoundaryCollision(ship, localPlayerId);
      }
    }
  }

  /**
   * Handle ship hitting the boundary
   */
  private handleBoundaryCollision(ship: Ship, localPlayerId: string): void {
    logger.debug('COLLISION', 'Ship hit boundary', {
      shipPos: ship.position,
      shipId: ship.id,
      localPlayerId,
    });

    // The caller passes only the local player's ship, so always send damage for boundary collisions
    const serverPlayerId = this.networkManager.getLocalPlayerId();

    // Send boundary collision message to server
    this.networkManager.sendMessage({
      type: 'collisionDamage',
      data: {
        targetPlayerId: serverPlayerId,
        attackerId: 'boundary',
        damage: DAMAGE.BOUNDARY_COLLISION,
      },
    });
  }

  /**
   * Check player collisions with asteroids (unified for all player types)
   */
  checkPlayerAsteroidCollisions(player: CollisionActor, asteroids: Roid[]): void {
    const ship = player.ship;

    // Skip if ship is exploding, has no health, or is under spawn protection (blinking)
    if (isShipCollisionImmune(ship)) {
      if (ship.blinkCount > 0) {
        logger.debug('COLLISION', 'Skipping collision check - ship under spawn protection', {
          shipId: ship.id,
          blinkCount: ship.blinkCount,
          spawnProtectionTimer: ship.spawnProtectionTimer,
          position: ship.position,
        });
      }
      return;
    }

    // Check collisions with asteroids
    for (const asteroid of asteroids) {
      if (checkShipCollision(ship.position, ship.r, asteroid.position, asteroid.r)) {
        logger.debug('COLLISION', 'Player-asteroid collision detected', {
          shipPos: ship.position,
          shipRadius: ship.r,
          asteroidPos: asteroid.position,
          asteroidRadius: asteroid.r,
          playerId: player.id,
          playerType: player.type,
          shipHealth: ship.health,
          shipExploding: ship.exploding,
        });
        this.handlePlayerAsteroidCollision(player, asteroid);
        break; // Player can only collide with one asteroid per frame
      }
    }
  }

  /**
   * Check ship collisions with other ships (players/bots)
   */
  checkShipShipCollisions(localShip: Ship, others: CollisionActor[], localPlayerId: string): void {
    // Skip if local ship cannot collide: exploding, dead, or under spawn protection
    if (!localShip || isShipCollisionImmune(localShip)) {
      return;
    }

    let isColliding = false;

    for (const other of others) {
      if (other.id === localPlayerId) {
        continue;
      }
      const otherShip = other.ship;
      if (isShipCollisionImmune(otherShip)) {
        continue;
      }

      if (checkShipCollision(localShip.position, localShip.r, otherShip.position, otherShip.r)) {
        this.handleShipShipCollision(localShip, otherShip, localPlayerId);
        isColliding = true;
        break; // Only handle one collision per frame
      }
    }

    // If not colliding with any ship, stop collision damage
    if (!isColliding && localShip.isCollidingWithPlayer) {
      localShip.stopPlayerCollision();
    }
  }

  /**
   * Check laser collisions with asteroids and players (unified for all player types)
   */
  checkLaserCollisions(
    lasers: Laser[],
    asteroids: Roid[],
    players: CollisionActor[],
    localPlayerId: string
  ): void {
    for (let i = lasers.length - 1; i >= 0; i--) {
      const laser = lasers[i];
      if (laser === undefined) {
        continue;
      }

      // Skip lasers that are already exploding
      if (laser.hasExploded) {
        continue;
      }

      // Check collisions with asteroids
      for (const asteroid of asteroids) {
        if (checkLaserAsteroidCollision(laser.position, asteroid.position, asteroid.r)) {
          this.handleLaserAsteroidHit(laser, asteroid, localPlayerId);
          // Mark laser for explosion
          laser.updateExplodeTime();
          laser.playHitSound();
          break; // Laser can only hit one target
        }
      }

      // Check collisions with other players (if laser hasn't already hit something)
      if (!laser.hasExploded) {
        for (const player of players) {
          if (player.type === 'local' || player.id === localPlayerId) {
            continue;
          }
          const ship = player.ship;
          if (isShipCollisionImmune(ship)) {
            continue;
          }

          if (checkLaserShipCollision(laser.position, ship.position, ship.r)) {
            this.handleLaserPlayerHit(laser, player, localPlayerId);
            // Mark laser for explosion
            laser.updateExplodeTime();
            laser.playHitSound();
            break; // Laser can only hit one target
          }
        }
      }
    }
  }

  /**
   * Handle laser hitting an asteroid
   */
  private handleLaserAsteroidHit(laser: Laser, asteroid: Roid, attackerId: string): void {
    logger.debug('COLLISION', 'Laser hit asteroid', {
      laserPos: laser.position,
      asteroidPos: asteroid.position,
      asteroidId: asteroid.id,
      attackerId,
    });

    this.networkManager.sendMessage({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: asteroid.id,
        playerId: attackerId,
        points: getAsteroidPoints(asteroid.r),
      },
    });
  }

  /**
   * Handle laser hitting a player (unified for all player types)
   */
  private handleLaserPlayerHit(laser: Laser, player: CollisionActor, attackerId: string): void {
    const ship = player.ship;

    logger.debug('COLLISION', 'Laser hit player', {
      laserPos: laser.position,
      playerPos: ship.position,
      playerId: player.id,
      playerType: player.type,
      attackerId,
    });

    // Send appropriate damage message based on player type
    if (player.type === 'bot') {
      this.networkManager.sendMessage({
        type: 'botDamage',
        data: {
          botId: player.id,
          attackerId: attackerId,
          damage: DAMAGE.LASER_HIT,
        },
      });
    } else if (player.type === 'remote') {
      this.networkManager.sendMessage({
        type: 'laserDamage',
        data: {
          targetPlayerId: player.id,
          attackerId: attackerId,
          damage: DAMAGE.LASER_HIT,
        },
      });
    }
    // Local players are handled by the ship's takeDamage method directly
  }

  /**
   * Handle player hitting an asteroid (unified for all player types)
   */
  private handlePlayerAsteroidCollision(player: CollisionActor, asteroid: Roid): void {
    const ship = player.ship;

    logger.debug('COLLISION', 'Player hit asteroid', {
      shipPos: ship.position,
      asteroidPos: asteroid.position,
      shipId: ship.id,
      asteroidId: asteroid.id,
      playerId: player.id,
      playerType: player.type,
    });

    // Don't apply damage directly - let server handle it
    const damage = DAMAGE.LASER_HIT;
    logger.debug('COLLISION', 'Sending asteroid collision damage to server', {
      damage,
      playerId: player.id,
    });

    // Send appropriate network message based on player type
    if (player.type === 'local') {
      // For local players, use the server-assigned player ID
      const serverPlayerId = this.networkManager.getLocalPlayerId();
      if (serverPlayerId) {
        this.networkManager.sendMessage({
          type: 'collisionDamage',
          data: {
            targetPlayerId: serverPlayerId,
            attackerId: 'asteroid',
            damage: damage,
          },
        });

        // Send asteroid destruction message to server to trigger splitting
        this.networkManager.sendMessage({
          type: 'asteroidDestroyed',
          data: {
            asteroidId: asteroid.id,
            playerId: serverPlayerId,
            points: getAsteroidPoints(asteroid.r),
          },
        });
      }
    } else if (player.type === 'bot') {
      // For bots, send bot damage message
      this.networkManager.sendMessage({
        type: 'botDamage',
        data: {
          botId: player.id,
          attackerId: 'asteroid',
          damage: damage,
        },
      });

      // Send asteroid destruction message to server to trigger splitting
      this.networkManager.sendMessage({
        type: 'asteroidDestroyed',
        data: {
          asteroidId: asteroid.id,
          playerId: player.id,
          points: getAsteroidPoints(asteroid.r),
        },
      });
    }
    // Remote players are handled by server, no client-side network message needed
  }

  /**
   * Handle ship hitting another ship
   */
  private handleShipShipCollision(localShip: Ship, otherShip: Ship, localPlayerId: string): void {
    logger.debug('COLLISION', 'Ship hit ship', {
      localShipPos: localShip.position,
      otherShipPos: otherShip.position,
      localShipId: localShip.id,
      otherShipId: otherShip.id,
      localPlayerId,
    });

    // Start collision damage-over-time for the local ship
    localShip.startPlayerCollision(otherShip.id);
  }
}
