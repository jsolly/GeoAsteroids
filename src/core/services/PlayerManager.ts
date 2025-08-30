import { DEFAULT_BOT_COUNT } from '../../constants/game';
import type { BotShoot } from '../../entities/bot/types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Player } from '../../entities/player/Player';

import type { Ship } from '../../entities/ship/Ship';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import { shouldApplyDamageToLocalPlayer } from '../../physics/collision/collisionUtils';
import { isDebugMode } from '../../utils/debugUtils';
import { getRandomPositionWithinBoundary } from '../../utils/positionUtils';

export class PlayerManager {
  private static instance: PlayerManager;
  private multiplayerManager: MultiplayerManager;
  private localPlayer: Player | null = null;

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
    this.localPlayer = entityFactory.createLocalPlayer(
      this.multiplayerManager.getLocalPlayerName(),
      getRandomPositionWithinBoundary()
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
    const botCount = isDebugMode()
      ? parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10)
      : DEFAULT_BOT_COUNT;

    this.multiplayerManager.initializeBots(botCount);
  }

  updateMultiplayerState(): void {
    if (!this.localPlayer) {
      return;
    }

    if (this.multiplayerManager.isConnected) {
      const ship = this.localPlayer.ship;
      this.multiplayerManager.updatePlayerState({
        position: ship.position,
        velocity: ship.velocity,
        r: ship.r,
        angle: ship.angle,
        lives: this.localPlayer.lives,
        score: this.localPlayer.score,
        exploding: ship.exploding,
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
    window.addEventListener('botShoot', (event: Event) => {
      const botShoot = (event as CustomEvent).detail as BotShoot;
      this.handleBotShoot(botShoot);
    });
  }

  private handleBotShoot(botShoot: BotShoot): void {
    const ship = this.getLocalShip();

    // Check if ship is invincible
    if (ship.blinkCount > 0 || ship.exploding) {
      return;
    }

    // Check collision with bot laser
    if (this.checkBotLaserHit(botShoot)) {
      // Check if debug system wants to prevent damage to local player
      const shouldApplyDamage = shouldApplyDamageToLocalPlayer(ship);

      // Apply bot laser damage
      if (shouldApplyDamage) {
        ship.takeDamage(20); // Bot laser damage
      }
    }
  }

  private checkBotLaserHit(botShoot: BotShoot): boolean {
    const laserStart = { x: botShoot.laserStart.x, y: botShoot.laserStart.y };
    const laserDirection = { x: botShoot.laserDirection.x, y: botShoot.laserDirection.y };
    const shipPos = this.getLocalShip().position;
    const shipRadius = this.getLocalShip().r;

    // Calculate distance from laser line to ship center
    const laserEndX = laserStart.x + laserDirection.x * 1000;
    const laserEndY = laserStart.y + laserDirection.y * 1000;

    const lineCoeffA = laserEndY - laserStart.y;
    const lineCoeffB = laserStart.x - laserEndX;
    const lineCoeffC = laserEndX * laserStart.y - laserStart.x * laserEndY;

    const distance =
      Math.abs(lineCoeffA * shipPos.x + lineCoeffB * shipPos.y + lineCoeffC) /
      Math.sqrt(lineCoeffA * lineCoeffA + lineCoeffB * lineCoeffB);

    return distance <= shipRadius;
  }
}
