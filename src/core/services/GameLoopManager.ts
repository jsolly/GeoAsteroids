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
    // Use the local player's score instead of GameStateManager score for consistency
    const currScore = currPlayer.score;
    const textAlpha = this.gameController.getTextAlpha();
    const text = this.gameController.getText();

    // Always update player network state (invincibility/blink timers, explosions, regen)
    this.playerNetwork.updatePlayerState();

    // Update bot movement and behavior
    const botManager = BotManager.getInstance();
    botManager.updateBotsInGameLoop();

    // Update kill message timer
    this.gameController.updateKillMessageTimer();

    const allPlayers = this.playerNetwork.getAllPlayers();
    const otherPlayers = this.playerNetwork.getOtherPlayers();

    // Advance timers for non-local players
    for (const p of otherPlayers) {
      const ship = p.ship;
      ship.setBlinkOn();
      ship.updateInvincibility();
      ship.updateExplosion();
      // Do not regenerate health client-side for non-local players (server authoritative)
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
    // Do not move the local ship during respawn countdown
    if (!currShip.exploding && currPlayer.lives > 0 && currPlayer.respawnTimer === undefined) {
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
        // Do not render the local ship during the respawn countdown window
        if (player.respawnTimer === undefined) {
          if (ship.blinkOn) {
            drawLocalPlayerShip(player);
          }
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

          // Show death message with backdrop during respawn delay
          // Only show message after explosion animation is complete
          // Only show death messages for local player, not bots or remote players
          const messageDisplayFrames = 120; // 2 seconds at 60 FPS
          if (
            player.respawnTimer <= messageDisplayFrames &&
            player.deathCause &&
            player.type === 'local'
          ) {
            // Update game state to show death message
            const gameStateManager = this.gameController.getGameStateManager();
            const alpha = Math.min(1.0, (messageDisplayFrames - player.respawnTimer) / 30); // Fade in over 0.5 seconds
            gameStateManager.updateTextProperties(`You were killed by ${player.deathCause}`, alpha);
          }
        }

        if (player.respawnTimer === 0) {
          // Clear the death message before respawning (only for local player)
          if (player.type === 'local') {
            const gameStateManager = this.gameController.getGameStateManager();
            gameStateManager.updateTextAlpha(0);
          }

          // Only respawn local players and bots locally
          // Remote players are respawned by the server
          if (player.type !== 'remote') {
            player.respawn();
          }

          // Clear respawn timer for all player types
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
