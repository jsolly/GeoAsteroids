import { DEBUG, GAME } from '../../constants';
import type { BotShoot } from '../../entities/bot/types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Player } from '../../entities/player/Player';

import type { Ship } from '../../entities/ship/Ship';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import { getGameBoundary } from '../../physics/boundary';
import { shouldApplyDamageToLocalPlayer } from '../../physics/collision/collisionUtils';
import { isDebugMode } from '../../utils/debugUtils';
import {
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../../utils/positionUtils';

export class PlayerManager {
  private static instance: PlayerManager;
  private multiplayerManager: MultiplayerManager;
  private localPlayer: Player | null = null;
  private botShootHandler: ((event: Event) => void) | null = null;

  private constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();
  }

  static getInstance(): PlayerManager {
    if (!PlayerManager.instance) {
      PlayerManager.instance = new PlayerManager();
    }
    return PlayerManager.instance;
  }

  createLocalPlayer(): Player {
    const shouldPlaceNearCenter = isDebugMode() && DEBUG.PLACE_PLAYERS_NEAR_CENTER;

    const position = (() => {
      if (shouldPlaceNearCenter) {
        const boundary = getGameBoundary();
        const center = { x: boundary.cx, y: boundary.cy };
        return getRandomPositionNearPoint(center, 200);
      }
      return getRandomPositionWithinBoundary();
    })();

    this.localPlayer = entityFactory.createLocalPlayer(
      this.multiplayerManager.getLocalPlayerName(),
      position
    );
    return this.localPlayer;
  }

  getLocalPlayer(): Player {
    if (!this.localPlayer) {
      throw new Error('Local player not initialized');
    }
    return this.localPlayer;
  }

  getLocalShip(): Ship {
    return this.getLocalPlayer().ship;
  }

  initializeBots(): void {
    const botCount = isDebugMode() ? DEBUG.BOT_COUNT : GAME.BOT_COUNT;

    this.multiplayerManager.initializeBots(botCount);
  }

  updateMultiplayerState(): void {
    if (!this.localPlayer) {
      return;
    }

    if (this.multiplayerManager.isConnected) {
      const ship = this.localPlayer.ship;
      const lasers = ship.lasers.map((laser) => ({
        position: laser.position,
        velocity: laser.velocity,
        distTraveled: laser.distTraveled,
        explodeTime: laser.explodeTime,
        hasExploded: laser.hasExploded,
      }));

      this.multiplayerManager.updatePlayerState({
        position: ship.position,
        velocity: ship.velocity,
        r: ship.r,
        angle: ship.angle,
        lives: this.localPlayer.lives,
        score: this.localPlayer.score,
        exploding: ship.exploding,
        health: ship.health,
        maxHealth: ship.maxHealth,
        lasers: lasers,
      });
    }

    // Always update bots with local player info
    this.multiplayerManager.updateLocalPlayerForAllPlayers(
      this.localPlayer.ship.position,
      !this.localPlayer.isDead
    );
  }

  getBots(): Map<string, Player> {
    return this.multiplayerManager.getBots();
  }

  setPlayerName(name: string): void {
    this.multiplayerManager.setLocalPlayerName(name);
  }

  getPlayerName(): string {
    return this.multiplayerManager.getLocalPlayerName();
  }

  setupBotShootHandler(): void {
    // Store handler reference for proper cleanup
    this.botShootHandler = (event: Event) => {
      const botShoot = (event as CustomEvent).detail as BotShoot;
      this.handleBotShoot(botShoot);
    };

    window.addEventListener('botShoot', this.botShootHandler);
  }

  private handleBotShoot(botShoot: BotShoot): void {
    const ship = this.getLocalShip();
    const player = this.getLocalPlayer();

    // Check if ship is invincible
    // Also skip while awaiting respawn so no damage/events accrue
    if (ship.blinkCount > 0 || ship.exploding || player.respawnTimer !== undefined) {
      return;
    }

    // Check collision with bot laser
    if (this.checkBotLaserHit(botShoot)) {
      // Check if debug system wants to prevent damage to local player
      const shouldApplyDamage = shouldApplyDamageToLocalPlayer(ship);

      // Apply bot laser damage
      if (shouldApplyDamage) {
        ship.takeDamage(20, 'laser', botShoot.botId); // Bot laser damage
      }
    }
  }

  private checkBotLaserHit(botShoot: BotShoot): boolean {
    const laserStart = { x: botShoot.laserStart.x, y: botShoot.laserStart.y };
    const laserDirection = { x: botShoot.laserDirection.x, y: botShoot.laserDirection.y };
    const shipPos = this.getLocalShip().position;
    const shipRadius = this.getLocalShip().r;

    // Compute laser end point (1000 units along direction)
    const laserEnd = {
      x: laserStart.x + laserDirection.x * 1000,
      y: laserStart.y + laserDirection.y * 1000,
    };

    // Compute segment vector
    const seg = {
      x: laserEnd.x - laserStart.x,
      y: laserEnd.y - laserStart.y,
    };

    // Handle zero-length segment (avoid division by zero)
    const segLengthSquared = seg.x * seg.x + seg.y * seg.y;
    if (segLengthSquared === 0) {
      // Treat as point-to-point distance
      const dx = shipPos.x - laserStart.x;
      const dy = shipPos.y - laserStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= shipRadius;
    }

    // Compute t = ((shipPos - laserStart) · seg) / (seg · seg)
    const toShip = {
      x: shipPos.x - laserStart.x,
      y: shipPos.y - laserStart.y,
    };
    let t = (toShip.x * seg.x + toShip.y * seg.y) / segLengthSquared;

    // Clamp t to [0, 1] to stay within segment bounds
    t = Math.max(0, Math.min(1, t));

    // Compute closest point on segment
    const closestPoint = {
      x: laserStart.x + seg.x * t,
      y: laserStart.y + seg.y * t,
    };

    // Compute distance from closest point to ship center
    const dx = shipPos.x - closestPoint.x;
    const dy = shipPos.y - closestPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= shipRadius;
  }

  cleanup(): void {
    // Remove event listeners to prevent memory leaks
    if (this.botShootHandler) {
      window.removeEventListener('botShoot', this.botShootHandler);
      this.botShootHandler = null;
    }
  }
}
