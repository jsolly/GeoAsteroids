import { DAMAGE } from '../../constants';
import type { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { PlayerManager } from '../../entities/player/PlayerManager';
import { canDealCombatDamage } from '../../entities/player/softFactions';
import type { Roid } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';
import {
  applyShipBoundaryDeath,
  applyShipLethalCollision,
  isShipCollisionImmune,
} from '../../entities/ship/shipUtils';
import { NetworkManager } from '../../network/networkManager';
import { logger } from '../../utils/Logger';
import { isAsteroidPending, lockAsteroidPending } from './asteroidHitFeel';
import {
  checkBoundaryCollision,
  checkLaserAsteroidCollisionSwept,
  checkLaserShipCollision,
  checkShipCollision,
} from './collisionDetection';

export interface LaserCollisionOptions {
  /** Spectator clients play VFX only for remote-human shots. */
  reportAsteroidHits?: boolean;
}

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

    // Shared player+bot path: visible wall flash + explode, then the server
    // confirms the life loss. Waiting for the packet alone looked like a silent reset.
    applyShipBoundaryDeath(ship, 'boundary');

    const serverPlayerId = this.networkManager.getLocalPlayerId();
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
  checkPlayerAsteroidCollisions(
    player: { ship: Ship; id: string; type: 'local' | 'remote' | 'bot' },
    asteroids: Roid[]
  ): void {
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

    if (!ship.canTakeCollisionDamage()) {
      return;
    }

    // Check collisions with asteroids
    for (const asteroid of asteroids) {
      if (isAsteroidPending(asteroid)) {
        continue;
      }
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
  checkShipShipCollisions(
    localShip: Ship,
    otherShips: { ship: Ship; id: string }[],
    localPlayerId: string
  ): void {
    // Skip if local ship cannot collide: exploding, dead, or under spawn protection
    if (!localShip || isShipCollisionImmune(localShip)) {
      return;
    }

    let isColliding = false;

    for (const other of otherShips) {
      const otherShip = other.ship;
      if (isShipCollisionImmune(otherShip)) {
        continue;
      }

      if (
        canDealCombatDamage(this.factionForId(localPlayerId), this.factionForShip(otherShip)) &&
        checkShipCollision(localShip.position, localShip.r, otherShip.position, otherShip.r)
      ) {
        this.handleShipShipCollision(localShip, otherShip, other.id, localPlayerId);
        isColliding = true;
        break;
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
    players: { ship: Ship; id: string; type: 'local' | 'remote' | 'bot' }[],
    localPlayerId: string,
    options: LaserCollisionOptions = {}
  ): void {
    const reportAsteroidHits = options.reportAsteroidHits !== false;

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
        if (isAsteroidPending(asteroid)) {
          continue;
        }
        const from = laser.prevPosition ?? laser.position;
        if (checkLaserAsteroidCollisionSwept(from, laser.position, asteroid.position, asteroid.r)) {
          this.handleLaserAsteroidHit(laser, asteroid, localPlayerId, reportAsteroidHits);
          // Mark laser for explosion
          laser.updateExplodeTime();
          laser.playHitSound();
          break; // Laser can only hit one target
        }
      }

      // Check collisions with other players (if laser hasn't already hit something)
      if (!laser.hasExploded) {
        for (const player of players) {
          const ship = player.ship;
          // Skip players that are exploding or have no health
          if (isShipCollisionImmune(ship)) {
            continue;
          }

          if (
            canDealCombatDamage(this.factionForId(localPlayerId), this.factionForId(player.id)) &&
            checkLaserShipCollision(laser.position, ship.position, ship.r)
          ) {
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
  private handleLaserAsteroidHit(
    laser: Laser,
    asteroid: Roid,
    attackerId: string,
    reportAsteroidHits: boolean
  ): void {
    logger.debug('COLLISION', 'Laser hit asteroid', {
      laserPos: laser.position,
      asteroidPos: asteroid.position,
      asteroidId: asteroid.id,
      attackerId,
      reportAsteroidHits,
    });

    if (asteroid.isCollabTarget) {
      if (reportAsteroidHits) {
        this.reportAsteroidDamage(asteroid, attackerId);
      }
      return;
    }

    lockAsteroidPending(asteroid);

    if (!reportAsteroidHits) {
      return;
    }

    this.reportAsteroidDestroyed(asteroid, attackerId);
  }

  /**
   * Handle laser hitting a player (unified for all player types)
   */
  private handleLaserPlayerHit(
    laser: Laser,
    player: { ship: Ship; id: string; type: 'local' | 'remote' | 'bot' },
    attackerId: string
  ): void {
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
  private handlePlayerAsteroidCollision(
    player: { ship: Ship; id: string; type: 'local' | 'remote' | 'bot' },
    asteroid: Roid
  ): void {
    const ship = player.ship;

    logger.debug('COLLISION', 'Player hit asteroid', {
      shipPos: ship.position,
      asteroidPos: asteroid.position,
      shipId: ship.id,
      asteroidId: asteroid.id,
      playerId: player.id,
      playerType: player.type,
    });

    lockAsteroidPending(asteroid);
    ship.lastCollisionTime = Date.now();
    asteroid.playHitSound();

    const damage = DAMAGE.ASTEROID_COLLISION;
    logger.debug('COLLISION', 'Sending asteroid collision damage to server', {
      damage,
      playerId: player.id,
    });

    // Same instant flash/explode as the wall — waiting for a 25-hp packet
    // plus a 3s corpse timer is what felt like freeze-stick.
    if (player.type === 'local') {
      const serverPlayerId = this.networkManager.getLocalPlayerId();
      if (serverPlayerId) {
        applyShipLethalCollision(ship, 'asteroid');
        this.networkManager.sendMessage({
          type: 'collisionDamage',
          data: {
            targetPlayerId: serverPlayerId,
            attackerId: 'asteroid',
            damage,
          },
        });

        this.reportAsteroidDestroyed(asteroid, serverPlayerId);
      }
    } else if (player.type === 'bot') {
      applyShipLethalCollision(ship, 'asteroid');
      this.networkManager.sendMessage({
        type: 'botDamage',
        data: {
          botId: player.id,
          attackerId: 'asteroid',
          damage,
        },
      });

      this.reportAsteroidDestroyed(asteroid, player.id);
    }
    // Remote players are handled by server, no client-side network message needed
  }

  private reportAsteroidDestroyed(asteroid: Roid, playerId: string): void {
    this.networkManager.sendMessage({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: asteroid.id,
        playerId,
        points: this.getAsteroidPoints(asteroid.r),
      },
    });
  }

  private reportAsteroidDamage(asteroid: Roid, playerId: string): void {
    this.networkManager.sendMessage({
      type: 'asteroidDamage',
      data: {
        asteroidId: asteroid.id,
        playerId,
        damage: DAMAGE.LASER_HIT,
        points: this.getAsteroidPoints(asteroid.r),
      },
    });
  }

  private factionForId(playerId: string): Player['factionId'] {
    if (!playerId) {
      return undefined;
    }
    const fromNet = this.networkManager.getPlayer(playerId);
    if (fromNet) {
      return fromNet.factionId;
    }
    const local = PlayerManager.getInstance().getLocalPlayer();
    if (local && (local.id === playerId || this.networkManager.getLocalPlayerId() === playerId)) {
      return local.factionId;
    }
    return undefined;
  }

  private factionForShip(ship: Ship): Player['factionId'] {
    const match = this.networkManager.getAllPlayers().find((player) => player.ship === ship);
    return match?.factionId;
  }

  /**
   * Handle ship hitting another ship
   */
  private handleShipShipCollision(
    localShip: Ship,
    otherShip: Ship,
    otherPlayerId: string,
    localPlayerId: string
  ): void {
    logger.debug('COLLISION', 'Ship hit ship', {
      localShipPos: localShip.position,
      otherShipPos: otherShip.position,
      localShipId: localShip.id,
      otherShipId: otherShip.id,
      otherPlayerId,
      localPlayerId,
    });

    localShip.startPlayerCollision(otherPlayerId);
  }

  /**
   * Get points for destroying an asteroid based on its size
   */
  private getAsteroidPoints(radius: number): number {
    if (radius >= 40) {
      return 20; // Large asteroid
    } else if (radius >= 20) {
      return 50; // Medium asteroid
    } else {
      return 100; // Small asteroid
    }
  }
}
