import { SHIP_INV_BLINK_DUR } from '../constants/entities/ship';
import { EMP_PULSE_DURATION, EMP_PULSE_RADIUS } from '../constants/game';
import { FPS } from '../constants/physics';
import { initializeCanvas } from '../constants/rendering/canvas';
import { BotManager } from '../entities/bot/botManager';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import type { Ship } from '../entities/ship/Ship';
import { drawEmpPulse, drawShipExplosion, drawShipRelative } from '../entities/ship/shipRenderer';
import {
  detectBoundaryCollisions,
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerAsteroidCollisions,
  detectPlayerBoundaryCollisions,
  detectPlayerLaserShipCollisions,
  detectRoidHits,
  detectShipToShipCollisions,
} from '../physics/collision';
import { drawGameCanvas } from '../rendering/canvas';
import { GameController } from './gameController';

const gameController = GameController.getInstance();
const playerNetwork = PlayerNetwork.getInstance();

// Initialize canvas with proper scaling after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCanvas);
} else {
  initializeCanvas();
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

function updateGame(): void {
  const currShip = gameController.getCurrShip();
  const currPlayer = gameController.getCurrPlayer();
  const currRoidBelt = gameController.getCurrRoidBelt();
  const currScore = gameController.getCurrScore();
  const personalBest = gameController.getPersonalBest();
  const textAlpha = gameController.getTextAlpha();
  const text = gameController.getText();

  handleLevelUp();

  // Always update player network state (invincibility/blink timers, explosions, regen)
  // This now handles ALL players (local + remote + bots) in a unified way
  playerNetwork.updatePlayerState();

  // Update bot movement and behavior
  const botManager = BotManager.getInstance();
  botManager.updateBotsInGameLoop();

  drawGameCanvas(currShip, currRoidBelt, currScore, personalBest, textAlpha, text);

  handleShipState(currShip);
  handleCollision(currShip);

  // Only move ship if it's not exploding and player has lives remaining
  if (!currShip.exploding && currPlayer.lives > 0) {
    currShip.move();
  }

  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

function handleLevelUp(): void {
  if (gameController.getCurrScore() > gameController.getNextLevel()) {
    gameController.levelUp();
  }
}

function handleShipState(ship: Ship): void {
  try {
    ship.setBlinkOn();
    ship.setExploding();
    ship.updateEmpPulse(); // Update EMP pulse state

    if (!ship.exploding) {
      if (ship.blinkOn) {
        drawShipRelative(ship, ship.color);
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

function handleCollision(ship: Ship): void {
  try {
    const currRoidBelt = gameController.getCurrRoidBelt();

    // Get bots and bot bullets for collision detection
    const bots = gameController.getBots();

    // Check for boundary collisions first
    if (detectBoundaryCollisions(ship)) {
      // Boundary collision detected, ship will explode and respawn
      return;
    }

    gameController.updateCurrScore(detectLaserHits(currRoidBelt, ship, bots));
    gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));

    // Get all other players (bots + remote players)
    const allOtherPlayers = [...Array.from(bots.values()), ...playerNetwork.getOtherPlayers()];

    if (allOtherPlayers.length > 0) {
      // Unified collision detection for all players
      gameController.updateCurrScore(detectLaserPlayerCollisions(ship, allOtherPlayers));

      // Unified boundary collision detection
      detectPlayerBoundaryCollisions(allOtherPlayers);

      // Unified ship-to-ship collision detection
      gameController.updateCurrScore(detectShipToShipCollisions(ship, allOtherPlayers));

      // Unified laser collision detection
      detectPlayerLaserShipCollisions(ship, allOtherPlayers);

      // Unified asteroid collision detection for all players
      detectPlayerAsteroidCollisions(allOtherPlayers, currRoidBelt);
    }

    gameController.updatePersonalBest();
  } catch (error) {
    console.error('EVENT_LOOP', 'Error in collision handling', { error });
  }
}
