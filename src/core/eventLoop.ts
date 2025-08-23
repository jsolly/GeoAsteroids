import { SHIP_INV_BLINK_DUR, SHIP_INV_DUR } from '../constants/entities/ship';
import { DRAW_ASTEROIDS, EMP_PULSE_DURATION, EMP_PULSE_RADIUS } from '../constants/game';
import { FPS } from '../constants/physics';
import { musicIsOn } from '../constants/preferences';
import { BotPlayer } from '../entities/bot/BotPlayer';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import type { Player } from '../entities/player/types';
import type { Ship } from '../entities/ship/Ship';
import { drawEmpPulse, drawShipExplosion, drawShipRelative } from '../entities/ship/shipRenderer';
import {
  detectAllPlayerBotCollisions,
  detectBotAsteroidCollisions,
  detectBotBoundaryCollisions,
  detectBotLaserPlayerCollisions,
  detectBotShipCollisions,
  detectBoundaryCollisions,
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerBoundaryCollisions,
  detectPlayerLaserShipCollisions,
  detectRoidHits,
  detectShipToShipCollisions,
} from '../physics/collisions';

import { drawGameCanvas } from '../rendering/canvas';
import { GameController } from './gameController';

const gameController = GameController.getInstance();
const playerNetwork = PlayerNetwork.getInstance();

window.addEventListener('gameStart', () => {
  // Game started, setting up game loop

  // Set up bot shoot handler if multiplayer is enabled
  if (gameController.isMultiplayerEnabled()) {
    gameController.setupBotShootHandler();
  }

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

// Add event listener for ship explosion
window.addEventListener('shipExploded', () => {
  const player = gameController.getCurrPlayer();
  if (player) {
    // Ship has exploded, just decrement player lives
    // The explosion animation will be handled by the normal game loop
    player.lives--;
  }
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
  playerNetwork.updatePlayerState();

  // Update bot systems only when multiplayer is enabled
  if (gameController.isMultiplayerEnabled()) {
    // Update all bot systems at the same framerate as the main game loop
    gameController.updateBotsInGameLoop();
  }

  drawGameCanvas(currShip, currRoidBelt, currScore, personalBest, textAlpha, text);

  handleMusic();
  handleShipState(currShip, currPlayer);
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

function handleMusic(): void {
  if (musicIsOn()) {
    gameController.tickMusic();
  }
}

function handleShipState(ship: Ship, player: Player): void {
  try {
    ship.setBlinkOn();
    ship.setExploding();
    ship.updateEmpPulse(); // Update EMP pulse state

    if (!ship.exploding) {
      if (player.lives > 0 && ship.blinkOn) {
        drawShipRelative(ship, player.color);
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
      handleShipExplosion(ship, player);
    }
  } catch (error: unknown) {
    console.error('EVENT_LOOP', 'Error in ship state handling', { error });
  }
}

function handleShipExplosion(ship: Ship, player: Player): void {
  // Only draw explosion if it's still in progress
  if (ship.explodeTime > 0) {
    drawShipExplosion(ship, player.color);
    ship.explodeTime--;
  }

  if (ship.explodeTime === 0) {
    // Explosion finished, check if player has lives remaining
    if (player.lives > 0) {
      // Player still has lives - respawn the ship
      ship.exploding = false;
      ship.explodeTime = 0;
      // Give ship temporary invincibility (blinking effect)
      ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
      ship.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
      ship.blinkOn = true;

      // Reset ship health to full
      ship.health = ship.maxHealth;
      ship.lastDamageTime = 0;
      ship.healthRegenTimer = 0;

      // Reset ship position to center
      ship.position = { x: 0, y: 0 }; // Use world origin instead of canvas center
      ship.velocity = { x: 0, y: 0 };
      ship.angle = (90 / 180) * Math.PI; // Reset to upward direction
    } else {
      // No lives remaining - game over
      // Don't respawn the ship, just call gameOver
      // The ship will remain exploded and won't be drawn
      gameController.gameOver();
    }
  }
}

function handleCollision(ship: Ship): void {
  try {
    const currRoidBelt = gameController.getCurrRoidBelt();

    // Get bots and bot bullets for collision detection
    const bots = gameController.isMultiplayerEnabled() ? gameController.getBots() : undefined;
    // Legacy bot bullets removed – collisions read bot lasers directly from manager

    // Check for boundary collisions first
    if (detectBoundaryCollisions(ship)) {
      // Boundary collision detected, ship will explode and respawn
      return;
    }

    gameController.updateCurrScore(detectLaserHits(currRoidBelt, ship, bots));
    if (DRAW_ASTEROIDS) {
      gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));
    }

    // Add ship-to-ship collision detection
    if (bots && bots.size > 0) {
      gameController.updateCurrScore(detectShipToShipCollisions(ship, bots));

      // Add bot boundary collision detection
      detectBotBoundaryCollisions(bots);

      // Add bot-asteroid collision detection
      detectBotAsteroidCollisions(bots, currRoidBelt);

      // Add bot-ship collision detection
      detectBotShipCollisions(ship, bots);
    }

    // Add laser-to-player collision detection for any non-bot players present
    // Run this regardless of the multiplayer flag
    const otherPlayers = playerNetwork.getOtherPlayers();

    // Filter out bot players since they're handled by detectLaserHits
    const realPlayers = otherPlayers.filter((player) => !(player instanceof BotPlayer));

    if (realPlayers.length > 0) {
      gameController.updateCurrScore(detectLaserPlayerCollisions(ship, realPlayers));

      // Add boundary collision detection for other players
      detectPlayerBoundaryCollisions(realPlayers);

      // Add detection of other players' lasers hitting the local ship
      detectPlayerLaserShipCollisions(ship, realPlayers);

      // Add ship-to-ship collision detection between player and other players
      if (bots && bots.size > 0) {
        gameController.updateCurrScore(detectShipToShipCollisions(ship, bots, realPlayers));

        // Add collision detection between other players and bots
        detectAllPlayerBotCollisions(ship, realPlayers, bots);

        // Add bot laser collision detection on other players
        detectBotLaserPlayerCollisions(realPlayers, bots);
      }
    }

    gameController.updatePersonalBest();
  } catch (error) {
    console.error('EVENT_LOOP', 'Error in collision handling', { error });
  }
}
