import {
  DRAW_ASTEROIDS,
  EMP_PULSE_DURATION,
  EMP_PULSE_RADIUS,
  FPS,
  musicIsOn,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
} from '../constants';
import type { Player } from '../entities/player';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import type { Ship } from '../entities/ship/Ship';
import { drawEmpPulse, drawShipExplosion, drawShipRelative } from '../entities/ship/shipRenderer';
import {
  detectAllPlayerBotCollisions,
  detectBotAsteroidCollisions,
  detectBotLaserPlayerCollisions,
  detectBotShipCollisions,
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerLaserShipCollisions,
  detectRoidHits,
  detectShipToShipCollisions,
  detectTestPlayerAsteroidCollisions,
  detectTestPlayerCollisions,
} from '../physics/collisions';
import { Vector } from '../physics/Vector';
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
      console.error('GAME_LOOP', 'Error in game loop', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});

// Add event listener for ship life loss
window.addEventListener('shipLifeLost', () => {
  const ship = gameController.getCurrShip();
  const player = gameController.getCurrPlayer();
  if (ship && player) {
    handleShipLifeLoss(ship, player);
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

  // Enhanced ship state logging (disabled to prevent spam)
  // if (currShip.dead || currShip.exploding) {
  //   console.log('🚨 SHIP IN DANGER:', {
  //     frame: Date.now(),
  //     score: currScore,
  //     level: gameController.getGameState().getCurrentLevel(),
  //     shipPos: { x: currShip.position.x, y: currShip.position.y },
  //     shipDead: currShip.dead,
  //     shipExploding: currShip.exploding,
  //     shipLives: ship.lives,
  //     shipBlinkCount: ship.blinkCount,
  //     textAlpha,
  //     text,
  //     multiplayerEnabled: gameController.isMultiplayerEnabled(),
  //   });
  // }

  // Log game state for debugging
  // console.debug('GAME_LOOP', 'Game update', {
  //   score: currScore,
  //   level: gameController.getGameState().getCurrentLevel(),
  //   shipPos: { x: currShip.centroid.x, y: currShip.centroid.y },
  //   shipDead: currShip.dead,
  //   shipExploding: currShip.exploding,
  //   textAlpha,
  //   text,
  //   multiplayerEnabled: gameController.isMultiplayerEnabled()
  // });

  handleLevelUp();

  // Always update player network state (invincibility/blink timers, explosions, regen)
  // This must run even if multiplayer is disabled so test players aren't permanently invincible
  // Test players start with blinkCount > 0 and need their timers decremented each frame
  playerNetwork.updatePlayerState();

  // Update bot systems only when multiplayer is enabled
  if (gameController.isMultiplayerEnabled()) {
    // Update all bot systems at the same framerate as the main game loop
    gameController.updateBotsInGameLoop();

    // Log bot information for debugging
    const bots = gameController.getBots();
    if (bots.size > 0) {
      // console.debug('GAME_LOOP', 'Bot update', {
      //   botCount: bots.size,
      //   bots: Array.from(bots.values()).map(bot => ({
      //     id: bot.id,
      //     name: bot.name,
      //     position: { x: bot.centroid.x, y: bot.centroid.y },
      //     behavior: bot.behaviorState
      //     }))
      //   });
    }
  }

  // Update test player movement and state in the main game loop
  // This ensures test players are processed at the same framerate as the main game
  updateTestPlayersInGameLoop();

  drawGameCanvas(currShip, currRoidBelt, currScore, personalBest, textAlpha, text);

  handleMusic();
  handleShipState(currShip, currPlayer);
  handleCollision(currShip);

  // Only move ship if it's not exploding and not dead
  if (!currShip.exploding && !currPlayer.isDead) {
    currShip.move();
  } else {
    // console.log('🚫 Ship movement blocked:', {
    //   exploding: currShip.exploding,
    //   dead: currPlayer.isDead,
    //   lives: currPlayer.lives,
    //   blinkCount: currShip.blinkCount,
    // });
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

    // Log ship state for debugging
    // console.debug('SHIP_STATE', 'Ship state update', {
    //   blinkOn: ship.blinkOn,
    //   dead: ship.dead,
    //   exploding: ship.exploding,
    //   blinkCount: ship.blinkCount,
    //   spawnProtectionTimer: ship.spawnProtectionTimer,
    //   empPulseActive: ship.empPulseActive,
    //   empPulseTime: ship.empPulseTime
    // });

    if (!ship.exploding) {
      if (ship.blinkOn && !player.isDead) {
        // console.debug('SHIP_STATE', 'Drawing ship', {
        //   pos: { x: ship.position.x, y: ship.position.y },
        //   angle: ship.a
        // });
        drawShipRelative(ship);
      }

      // Draw EMP pulse effect if active
      if (ship.empPulseActive) {
        const empAlpha = ship.empPulseTime / (EMP_PULSE_DURATION * FPS); // Fade out over duration
        drawEmpPulse(ship, EMP_PULSE_RADIUS, empAlpha);
        // console.debug('EMP_PULSE', 'Drawing EMP pulse effect', {
        //   alpha: empAlpha,
        //   timeRemaining: ship.empPulseTime
        // });
      }

      if (ship.blinkCount > 0) {
        ship.spawnProtectionTimer--;

        if (ship.spawnProtectionTimer === 0) {
          ship.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
          ship.blinkCount--;
          // console.debug('SHIP_STATE', 'Blink count decremented', { newBlinkCount: ship.blinkCount });
        }
      }
    } else {
      // console.debug('SHIP_STATE', 'Handling ship explosion');
      handleShipExplosion(ship, player);
    }
  } catch (error: unknown) {
    console.error('SHIP_STATE', 'Error in handleShipState', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}

function handleShipExplosion(ship: Ship, player: Player): void {
  // console.log('💥 Ship explosion handling START:', {
  //   explodeTime: ship.explodeTime,
  //   lives: ship.lives,
  //   dead: ship.dead,
  //   exploding: ship.exploding,
  //   blinkCount: ship.blinkCount,
  // });

  drawShipExplosion(ship);
  ship.explodeTime--;

  // console.log('💥 Ship explosion handling:', {
  //   explodeTime: ship.explodeTime,
  //   lives: ship.lives,
  //   dead: ship.dead,
  //   exploding: ship.exploding,
  // });

  if (ship.explodeTime === 0) {
    // console.log('⏰ Explosion time finished, checking respawn...');

    // Check if ship has lives remaining
    if (player.lives > 0) {
      // console.log('🔄 Respawning ship with', player.lives, 'lives remaining');

      // Respawn the ship
      // Note: ship.exploding will be set to false by the ship's updateExplosion method
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
      ship.position = new Vector(0, 0); // Use world origin instead of canvas center
      ship.velocity = new Vector(0, 0);
      ship.a = (90 / 180) * Math.PI; // Reset to upward direction

      // console.log('✅ Ship respawned successfully:', {
      //   dead: ship.dead,
      //   exploding: ship.exploding,
      //   blinkCount: ship.blinkCount,
      //   position: { x: ship.position.x, y: ship.position.y },
      // });
    } else {
      // console.log('💀 No lives remaining - game over');
      // No lives remaining - game over
      gameController.gameOver();
    }
  } else {
    // console.log(
    //   '⏳ Explosion still in progress, time remaining:',
    //   ship.explodeTime,
    // );
  }
}

function handleShipLifeLoss(ship: Ship, player: Player): void {
  // Ship lost a life but still has lives remaining
  // Give temporary invincibility and reset position
  // Note: ship.exploding will be set to false by the ship's updateExplosion method
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
  ship.position = new Vector(0, 0);
  ship.velocity = new Vector(0, 0);
  ship.a = (90 / 180) * Math.PI; // Reset to upward direction

  console.info('SHIP_LIFE_LOST_HANDLED', 'Ship life lost, respawning with invincibility', {
    remainingLives: player.lives,
    health: ship.health,
    blinkCount: ship.blinkCount,
    position: { x: ship.position.x, y: ship.position.y },
  });
}

function handleCollision(ship: Ship): void {
  try {
    const currRoidBelt = gameController.getCurrRoidBelt();

    // Get bots and bot bullets for collision detection
    const bots = gameController.isMultiplayerEnabled() ? gameController.getBots() : undefined;
    // Legacy bot bullets removed – collisions read bot lasers directly from manager

    gameController.updateCurrScore(detectLaserHits(currRoidBelt, ship, bots));
    if (DRAW_ASTEROIDS) {
      gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));
    }

    // Add ship-to-ship collision detection
    if (bots && bots.size > 0) {
      gameController.updateCurrScore(detectShipToShipCollisions(ship, bots));

      // Add bot-asteroid collision detection
      detectBotAsteroidCollisions(bots, currRoidBelt);

      // Add bot-ship collision detection
      detectBotShipCollisions(ship, bots);
    }

    // Add laser-to-player collision detection for any non-bot players present
    // Run this regardless of the multiplayer flag so test players can be damaged
    const otherPlayers = playerNetwork.getOtherPlayers();

    // Filter out bot players since they're handled by detectLaserHits
    const realPlayers = otherPlayers.filter((player) => !player.isBot);

    if (realPlayers.length > 0) {
      gameController.updateCurrScore(detectLaserPlayerCollisions(ship, realPlayers));

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

      // Add test player asteroid collision detection
      if (DRAW_ASTEROIDS) {
        detectTestPlayerAsteroidCollisions(realPlayers, currRoidBelt);
      }

      // Add comprehensive test player collision detection
      // This ensures test players participate in all collision types, not just asteroids
      detectTestPlayerCollisions(ship, realPlayers, currRoidBelt, bots);
    } else {
      console.debug('COLLISION_DEBUG', 'No real players found for collision detection');
    }

    gameController.updatePersonalBest();
  } catch (error) {
    console.error('COLLISION', 'Error in handleCollision', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}

/**
 * Update test players in the main game loop to ensure consistent framerate
 * and proper integration with the collision system
 */
function updateTestPlayersInGameLoop(): void {
  const otherPlayers = playerNetwork.getOtherPlayers();
  const testPlayers = otherPlayers.filter((player) => player.id.startsWith('test-'));

  if (testPlayers.length === 0) {
    return;
  }

  // Update test player movement and state at game loop framerate
  for (const player of testPlayers) {
    // Skip exploding players
    if (player.ship.exploding) {
      continue;
    }

    // Update test player movement (simple AI-like behavior)
    updateTestPlayerMovement(player);

    // Update test player lasers if they have any
    if (player.ship.lasers && player.ship.lasers.length > 0) {
      player.ship.moveLasers();
    }
  }

  console.debug('GAME_LOOP', 'Test players updated in game loop', {
    testPlayerCount: testPlayers.length,
    testPlayers: testPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      position: { x: p.ship.position.x, y: p.ship.position.y },
      exploding: p.ship.exploding,
      blinkCount: p.ship.blinkCount,
    })),
  });
}

/**
 * Simple movement AI for test players to make them more interactive
 * We use a union type to handle both Player class instances and Player interface objects
 */
function updateTestPlayerMovement(
  player: Player | { ship: { position: Vector; a: number } }
): void {
  // Simple wandering behavior - move in current direction with occasional direction changes
  if (Math.random() < 0.01) {
    // 1% chance per frame to change direction
    player.ship.a += (Math.random() - 0.5) * 0.5; // Small random rotation
  }

  // Apply small forward movement
  const moveSpeed = 0.5; // Slower than player ship
  const velocity = new Vector(
    Math.cos(player.ship.a) * moveSpeed,
    Math.sin(player.ship.a) * moveSpeed
  );

  // Create new position instead of modifying existing one
  const newPosition = new Vector(
    player.ship.position.x + velocity.x,
    player.ship.position.y + velocity.y
  );
  player.ship.position = newPosition;

  // Keep test players within reasonable bounds
  const maxDistance = 800;
  const distance = Math.sqrt(player.ship.position.x ** 2 + player.ship.position.y ** 2);

  if (distance > maxDistance) {
    // Move back towards center
    const angle = Math.atan2(player.ship.position.y, player.ship.position.x);
    const newBoundedPosition = new Vector(
      Math.cos(angle) * (maxDistance * 0.8),
      Math.sin(angle) * (maxDistance * 0.8)
    );
    player.ship.position = newBoundedPosition;
  }
}
