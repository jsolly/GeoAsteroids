import { EMP, GAME, SHIP } from '../../constants';
import { BotManager } from '../../entities/bot/botManager';
import type { Player } from '../../entities/player/Player';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import {
  drawEmpPulse,
  drawLocalPlayerShip,
  drawShipExplosion,
} from '../../entities/ship/shipRenderer';
import { CollisionManager } from '../../physics/CollisionManager';
import { canvasManager } from '../../rendering/canvas';
import { logger } from '../../utils/Logger';
import { GameController } from '../gameController';

export class GameLoopManager {
  private static instance: GameLoopManager;
  private gameController: GameController;
  private playerNetwork: PlayerNetwork;
  private collisionManager: CollisionManager;

  private constructor() {
    this.gameController = GameController.getInstance();
    this.playerNetwork = PlayerNetwork.getInstance();
    this.collisionManager = CollisionManager.getInstance();
  }

  static getInstance(): GameLoopManager {
    if (!GameLoopManager.instance) {
      GameLoopManager.instance = new GameLoopManager();
    }
    return GameLoopManager.instance;
  }

  updateGame(): void {
    const currShip = this.gameController.getCurrShip();
    const currPlayer = this.gameController.getCurrPlayer();
    const currRoidBelt = this.gameController.getCurrRoidBelt();
    const currScore = this.gameController.getCurrScore();
    const textAlpha = this.gameController.getTextAlpha();
    const text = this.gameController.getText();

    // Always update player network state (invincibility/blink timers, explosions, regen)
    this.playerNetwork.updatePlayerState();

    // Update bot movement and behavior
    const botManager = BotManager.getInstance();
    botManager.updateBotsInGameLoop();

    const allPlayers = this.playerNetwork.getAllPlayers();
    const otherPlayers = this.playerNetwork.getOtherPlayers();

    // Advance timers for non-local players
    for (const p of otherPlayers) {
      const ship = p.ship;
      ship.setBlinkOn();
      ship.updateInvincibility();
      ship.updateExplosion();
    }

    // Handle all player respawn timers
    this.handleAllPlayerRespawns(allPlayers);

    // Render the game
    canvasManager.drawGame(
      currPlayer,
      currRoidBelt,
      currScore,
      textAlpha,
      text,
      currPlayer.lives,
      allPlayers
    );

    // Handle ship state and collisions
    this.handleShipState(currPlayer);
    this.handleCollision(currPlayer);

    // Handle ship movement and updates
    if (!currShip.exploding && currPlayer.lives > 0) {
      currShip.move();
    }

    currShip.moveLasers();

    // Move lasers for all non-local players
    for (const p of otherPlayers) {
      p.ship.moveLasers();
    }

    currRoidBelt.moveRoids();
    // Disable local asteroid spawning in multiplayer mode - server is authoritative
    // currRoidBelt.spawnRoids();
  }

  private handleShipState(player: Player): void {
    const ship = player.ship;

    try {
      const wasExploding = ship.exploding;
      ship.setBlinkOn();
      ship.setExploding();
      ship.updateEmpPulse();

      if (wasExploding !== ship.exploding) {
        logger.debug('EVENT_LOOP', 'Player ship exploding state changed', {
          playerId: player.id,
          wasExploding,
          nowExploding: ship.exploding,
        });
      }

      if (!ship.exploding) {
        if (ship.blinkOn) {
          drawLocalPlayerShip(player);
        }

        // Draw EMP pulse effect if active
        if (ship.empPulseActive) {
          const empAlpha = ship.empPulseTime / (EMP.DURATION * GAME.FPS);
          drawEmpPulse(ship, EMP.RADIUS, empAlpha);
        }

        if (ship.blinkCount > 0) {
          ship.spawnProtectionTimer--;

          if (ship.spawnProtectionTimer === 0) {
            ship.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
            ship.blinkCount--;
          }
        }
      } else {
        this.handleShipExplosion(player);
      }
    } catch (error: unknown) {
      logger.error(
        'EVENT_LOOP',
        'Error in ship state handling',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private handleShipExplosion(player: Player): void {
    const ship = player.ship;

    // Only draw explosion if it's still in progress
    if (ship.explodeTime > 0) {
      drawShipExplosion(ship, ship.color);
      ship.explodeTime--;

      // Log only when explosion starts (at max time) and ends (at 0)
      // This reduces noise while still providing useful debugging information
      if (ship.explodeTime === 0) {
        logger.debug('EVENT_LOOP', 'Player explosion animation finished', { playerId: player.id });
      }
    }
  }

  private handleAllPlayerRespawns(players: Player[]): void {
    players.forEach((player) => {
      if (player.respawnTimer !== undefined) {
        if (player.respawnTimer > 0) {
          player.respawnTimer--;
        }

        if (player.respawnTimer === 0) {
          player.respawn();
          player.respawnTimer = undefined;
        }
      }
    });
  }

  private handleCollision(player: Player): void {
    try {
      const currRoidBelt = this.gameController.getCurrRoidBelt();

      // Get all players for collision detection
      const allPlayers = this.playerNetwork.getAllPlayers();

      // Use unified collision detection
      const collisionResult = this.collisionManager.detectAllCollisions(
        player,
        currRoidBelt,
        allPlayers
      );

      // Update game score with collision results
      this.gameController.updateCurrScore(collisionResult.laserScore);
      this.gameController.updateCurrScore(collisionResult.roidScore);
      this.gameController.updateCurrScore(collisionResult.playerCollisionScore);
    } catch (error: unknown) {
      logger.error(
        'EVENT_LOOP',
        'Error in collision handling',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
