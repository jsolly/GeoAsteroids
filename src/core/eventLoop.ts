import { SHIP_INV_BLINK_DUR } from '../constants/entities/ship';
import { EMP_PULSE_DURATION, EMP_PULSE_RADIUS, FPS } from '../constants/game';
import { BotManager } from '../entities/bot/botManager';
import type { Player } from '../entities/player/Player';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import type { Ship } from '../entities/ship/Ship';
import { drawEmpPulse, drawShipExplosion, drawShipRelative } from '../entities/ship/shipRenderer';
import {
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerLaserShipCollisions,
} from '../physics/collision/laserCollisions';
import {
  detectPlayerRoidCollisions,
  detectRoidHits,
  detectShipToShipCollisions,
} from '../physics/collision/shipCollisions';
import {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
} from '../rendering/boundaryRenderer';
import { canvasManager } from '../rendering/canvas';
import { GameController } from './gameController';

const gameController = GameController.getInstance();
const playerNetwork = PlayerNetwork.getInstance();

// Initialize canvas with proper scaling after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => canvasManager.initialize());
} else {
  canvasManager.initialize();
}

// Set up main menu updates
(async () => {
  const { setupMainMenuUpdates } = await import('../ui/mainMenu');
  setupMainMenuUpdates();
})();

window.addEventListener('gameStart', () => {
  // Set up bot shoot handler
  gameController.setupBotShootHandler();

  function gameLoop(): void {
    if (!gameController.getIsGameRunning()) {
      return;
    }

    try {
      updateGame();
    } catch (error) {
      console.error('EVENT_LOOP', 'Error in game loop', { error });
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});

// FPS calculation variables
let lastFrameTime = performance.now();
let currentFPS = 60;

function updateGame(): void {
  const currShip = gameController.getCurrShip();
  const currPlayer = gameController.getCurrPlayer();
  const currRoidBelt = gameController.getCurrRoidBelt();
  const currScore = gameController.getCurrScore();
  const textAlpha = gameController.getTextAlpha();
  const text = gameController.getText();

  // Calculate FPS
  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  lastFrameTime = now;
  currentFPS = 1000 / deltaTime;

  // Always update player network state (invincibility/blink timers, explosions, regen)
  // This now handles ALL players (local + remote + bots) in a unified way
  playerNetwork.updatePlayerState();

  // Update bot movement and behavior
  const botManager = BotManager.getInstance();
  botManager.updateBotsInGameLoop();

  // Handle local player respawn timer
  handleLocalPlayerRespawn(currPlayer);

  const bots = gameController.getBots();
  const allPlayers = playerNetwork.getAllPlayers();
  const connectionStatus = playerNetwork.getConnectionStatus();
  canvasManager.drawGame(
    currShip,
    currRoidBelt,
    currScore,
    textAlpha,
    text,
    bots,
    currPlayer.lives,
    allPlayers,
    currPlayer.id,
    connectionStatus.connected,
    currentFPS
  );

  handleShipState(currShip);
  handleCollision(currShip);

  // Handle ship movement and updates
  if (!currShip.exploding && currPlayer.lives > 0) {
    currShip.move();
  }

  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

function handleShipState(ship: Ship): void {
  try {
    ship.setBlinkOn();
    ship.setExploding();
    ship.updateEmpPulse(); // Update EMP pulse state

    if (!ship.exploding) {
      if (ship.blinkOn) {
        drawShipRelative(ship);
      }

      // Draw EMP pulse effect if active
      if (ship.empPulseActive) {
        const empAlpha = ship.empPulseTime / (EMP_PULSE_DURATION * FPS); // Fade out over duration
        drawEmpPulse(ship, EMP_PULSE_RADIUS, empAlpha);
      }

      if (ship.blinkCount > 0) {
        ship.spawnProtectionTimer--;

        if (ship.spawnProtectionTimer === 0) {
          ship.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
          ship.blinkCount--;
        }
      }
    } else {
      handleShipExplosion(ship);
    }
  } catch (error: unknown) {
    console.error('EVENT_LOOP', 'Error in ship state handling', { error });
  }
}

function handleShipExplosion(ship: Ship): void {
  // Only draw explosion if it's still in progress
  if (ship.explodeTime > 0) {
    drawShipExplosion(ship, ship.color);
    ship.explodeTime--;
  }

  if (ship.explodeTime === 0) {
    // Explosion finished, ship will be handled by Player via events
    // No need to manually manage respawn here
  }
}

function handleLocalPlayerRespawn(player: Player): void {
  // Handle local player respawn timer
  if (player.respawnTimer !== undefined) {
    if (player.respawnTimer > 0) {
      player.respawnTimer--;
    }

    if (player.respawnTimer === 0) {
      // Respawn timer expired, respawn the player
      player.respawn();
      player.respawnTimer = undefined;
    }
  }
}

function handleCollision(ship: Ship): void {
  try {
    const currRoidBelt = gameController.getCurrRoidBelt();

    // Get bots and bot bullets for collision detection
    const bots = gameController.getBots();

    // If we're in the middle of a respawn countdown, skip all collisions
    const currPlayer = gameController.getCurrPlayer();
    if (currPlayer.respawnTimer !== undefined) {
      return;
    }

    // Check for boundary collisions first (only when not awaiting respawn)
    if (detectBoundaryCollisions(ship)) {
      // Boundary collision detected, ship will explode and respawn
      return;
    }

    gameController.updateCurrScore(detectLaserHits(currRoidBelt, ship, bots));
    gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));

    // Performance optimization: limit roid processing to prevent slowdown
    const roidCount = currRoidBelt.roids.length;
    if (roidCount > 100) {
      console.warn(
        `Too many roids detected: ${roidCount}. Limiting collision checks to prevent slowdown.`
      );
      // Skip expensive collision checks when there are too many roids
      return;
    }

    // Performance optimization: limit laser processing to prevent slowdown
    const laserCount = ship.lasers.length;
    if (laserCount > 50) {
      console.warn(
        `Too many lasers detected: ${laserCount}. Limiting collision checks to prevent slowdown.`
      );
      // Skip expensive collision checks when there are too many lasers
      return;
    }

    // Get all other players (bots + remote players) - optimize to avoid array creation
    const botCount = bots.size;
    const otherPlayerCount = playerNetwork.getOtherPlayers().length;
    const totalPlayerCount = botCount + otherPlayerCount;

    // Performance optimization: limit entity processing to prevent slowdown
    if (totalPlayerCount > 20) {
      console.warn(
        `Too many entities detected: ${totalPlayerCount}. Limiting collision checks to prevent slowdown.`
      );
      // Skip expensive collision checks when there are too many entities
      return;
    }

    if (totalPlayerCount > 0) {
      // Only create the combined array if we actually need it
      const allOtherPlayers =
        totalPlayerCount > 10
          ? [...Array.from(bots.values()), ...playerNetwork.getOtherPlayers()]
          : Array.from(bots.values()).concat(playerNetwork.getOtherPlayers());

      // Unified collision detection for all players
      gameController.updateCurrScore(detectLaserPlayerCollisions(ship, allOtherPlayers));

      // Unified boundary collision detection
      detectPlayerBoundaryCollisions(allOtherPlayers);

      // Unified ship-to-ship collision detection
      gameController.updateCurrScore(detectShipToShipCollisions(ship, allOtherPlayers));

      // Unified laser collision detection
      detectPlayerLaserShipCollisions(ship, allOtherPlayers);

      // Unified roid collision detection for all players
      detectPlayerRoidCollisions(allOtherPlayers, currRoidBelt);
    }
  } catch (error) {
    console.error('EVENT_LOOP', 'Error in collision handling', { error });
  }
}
