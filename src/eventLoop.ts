import {
  FPS,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
  musicIsOn,
  EMP_PULSE_RADIUS,
  EMP_PULSE_DURATION,
} from './constants';
import {
  detectLaserHits,
  detectRoidHits,
  detectShipToShipCollisions,
  detectBotAsteroidCollisions,
  detectBotShipCollisions,
} from './collisions.js';
import { drawGameCanvas } from './canvas';
import { drawShipRelative, drawShipExplosion, drawEmpPulse } from './shipCanv';
import { GameController } from './gameController';
import { Ship } from './ship';
import { PlayerNetwork } from './playerNetwork.js';
import { Vector } from './vector.js';

const gameController = GameController.getInstance();
const playerNetwork = PlayerNetwork.getInstance();

window.addEventListener('gameStart', () => {
  // Game started, setting up game loop

  // Set up bot shoot handler if multiplayer is enabled
  if (gameController.isMultiplayerEnabled()) {
    gameController.setupBotShootHandler();
  }

  function gameLoop(): void {
    if (!gameController.getIsGameRunning()) return;

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
  if (ship) {
    handleShipLifeLoss(ship);
  }
});

function updateGame(): void {
  const currShip = gameController.getCurrShip();
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
  //     shipLives: currShip.lives,
  //     shipBlinkCount: currShip.blinkCount,
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

  // Update multiplayer state if enabled
  if (gameController.isMultiplayerEnabled()) {
    playerNetwork.updatePlayerState();

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

  drawGameCanvas(
    currShip,
    currRoidBelt,
    currScore,
    personalBest,
    textAlpha,
    text,
  );

  handleMusic();
  handleShipState(currShip);
  handleCollision(currShip);

  // Only move ship if it's not exploding and not dead
  if (!currShip.exploding && !currShip.dead) {
    currShip.move();
  } else {
    // console.log('🚫 Ship movement blocked:', {
    //   exploding: currShip.exploding,
    //   dead: currShip.dead,
    //   lives: currShip.lives,
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

function handleShipState(ship: Ship): void {
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
    //   blinkTime: ship.blinkTime,
    //   empPulseActive: ship.empPulseActive,
    //   empPulseTime: ship.empPulseTime
    // });

    if (!ship.exploding) {
      if (ship.blinkOn && !ship.dead) {
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
        ship.blinkTime--;

        if (ship.blinkTime == 0) {
          ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
          ship.blinkCount--;
          // console.debug('SHIP_STATE', 'Blink count decremented', { newBlinkCount: ship.blinkCount });
        }
      }
    } else {
      // console.debug('SHIP_STATE', 'Handling ship explosion');
      handleShipExplosion(ship);
    }
  } catch (error: unknown) {
    console.error('SHIP_STATE', 'Error in handleShipState', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shipPos: { x: ship.position.x, y: ship.position.y },
    });
  }
}

function handleShipExplosion(ship: Ship): void {
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

  if (ship.explodeTime == 0) {
    // console.log('⏰ Explosion time finished, checking respawn...');

    // Check if ship has lives remaining
    if (ship.lives > 0) {
      // console.log('🔄 Respawning ship with', ship.lives, 'lives remaining');

      // Respawn the ship
      ship.dead = false;
      ship.exploding = false;
      ship.explodeTime = 0;
      // Give ship temporary invincibility (blinking effect)
      ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
      ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
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

function handleShipLifeLoss(ship: Ship): void {
  // Ship lost a life but still has lives remaining
  // Give temporary invincibility and reset position
  ship.dead = false;
  ship.exploding = false;
  ship.explodeTime = 0;

  // Give ship temporary invincibility (blinking effect)
  ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
  ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  ship.blinkOn = true;

  // Reset ship health to full
  ship.health = ship.maxHealth;
  ship.lastDamageTime = 0;
  ship.healthRegenTimer = 0;

  // Reset ship position to center
  ship.position = new Vector(0, 0);
  ship.velocity = new Vector(0, 0);
  ship.a = (90 / 180) * Math.PI; // Reset to upward direction

  console.info(
    'SHIP_LIFE_LOST_HANDLED',
    'Ship life lost, respawning with invincibility',
    {
      remainingLives: ship.lives,
      health: ship.health,
      blinkCount: ship.blinkCount,
      position: { x: ship.position.x, y: ship.position.y },
    },
  );
}

function handleCollision(ship: Ship): void {
  try {
    const currRoidBelt = gameController.getCurrRoidBelt();

    // Get bots and bot bullets for collision detection
    const bots = gameController.isMultiplayerEnabled()
      ? gameController.getBots()
      : undefined;
    const botBullets = gameController.isMultiplayerEnabled()
      ? gameController.getBotBullets()
      : undefined;

    gameController.updateCurrScore(
      detectLaserHits(currRoidBelt, ship, bots, botBullets),
    );
    gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));

    // Add ship-to-ship collision detection
    if (bots && bots.size > 0) {
      gameController.updateCurrScore(detectShipToShipCollisions(ship, bots));

      // Add bot-asteroid collision detection
      detectBotAsteroidCollisions(bots, currRoidBelt);

      // Add bot-ship collision detection
      detectBotShipCollisions(ship, bots);
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
