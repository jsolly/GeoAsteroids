import {
  DEBUG,
  DRAW_ASTEROIDS,
  FPS,
  LASER_EXPLODE_DUR,
  SHIP_ASTEROID_DAMAGE,
  SHIP_BOT_DAMAGE,
  SHIP_EXPLODE_DUR_FRAMES,
  SHIP_HEALTH_REGEN_DELAY,
  SHIP_RESPAWN_DELAY_FRAMES,
} from '../constants';
import { GameController } from '../core/gameController.ts';
import { Asteroid, type AsteroidBelt } from '../entities/asteroid/Asteroid.ts';
import { BotManager } from '../entities/bot/botManager.ts';
// Simple logging - removed complex logger dependency
import type { BotPlayer } from '../entities/bot/types.ts';
import type { Player } from '../entities/player/types.ts';
import type { Laser, Ship } from '../entities/ship/Ship.ts';
import { isDevelopmentMode } from '../utils/debugUtils.ts';
import { Vector } from './Vector.ts';

// Test DEBUG constant at import time
// console.log('🔍 COLLISIONS: DEBUG constant imported as:', DEBUG, 'Type:', typeof DEBUG);

// botManager will be retrieved lazily inside functions to avoid circular issues

export function detectLaserHits(
  currAsteroidBelt: AsteroidBelt,
  currShip: Ship,
  bots?: Map<string, BotPlayer>
): number {
  const roids = currAsteroidBelt.roids;
  let score = 0;

  // detect laser hits on asteroids
  if (DRAW_ASTEROIDS) {
    for (let j = currShip.lasers.length - 1; j >= 0; j--) {
      for (let i = roids.length - 1; i >= 0; i--) {
        // detect hits
        if (isHit(currShip.lasers[j], roids[i])) {
          // remove asteroid and activate laser explosion
          Asteroid.fxHit.play();
          score = currAsteroidBelt.destroyRoid(i);
          currShip.updateLaserExplodeTime(j);
        }
      }
    }
  }

  // detect bot laser hits on asteroids (bots now use Laser)
  const botManager = BotManager.getInstance();
  const botLasersMap = botManager.getBotLasers();
  if (DRAW_ASTEROIDS && botLasersMap && botLasersMap.size > 0) {
    for (const [, lasers] of botLasersMap.entries()) {
      for (let j = lasers.length - 1; j >= 0; j--) {
        for (let i = roids.length - 1; i >= 0; i--) {
          if (isHit(lasers[j], roids[i])) {
            Asteroid.fxHit.play();
            score = currAsteroidBelt.destroyRoid(i);
            // trigger laser explode like player
            lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
            break;
          }
        }
      }
    }
  }

  // detect laser hits on bots (if bots are provided)
  if (bots && bots.size > 0) {
    for (let j = currShip.lasers.length - 1; j >= 0; j--) {
      const laser = currShip.lasers[j];

      // Skip lasers that are already exploding
      if (laser.explodeTime > 0) {
        continue;
      }

      const botEntries = Array.from(bots.entries());
      for (const [botId, bot] of botEntries) {
        // Skip exploding bots
        if (bot.ship.exploding) {
          continue;
        }

        // Skip invincible bots (blinking or time-based spawn protection)
        if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
          continue;
        }

        if (isLaserHitBot(laser, bot)) {
          // Deal damage to bot (same logic as botTakeDamage method)
          botManager.botTakeDamage(bot, SHIP_BOT_DAMAGE);

          currShip.updateLaserExplodeTime(j);

          // Add points for destroying a bot (only if bot is actually destroyed)
          if (bot.ship.exploding) {
            score += 200;
          }

          // Play hit sound
          Asteroid.fxHit.play();

          // Only dispatch event if bot is actually destroyed
          if (bot.ship.exploding) {
            window.dispatchEvent(
              new CustomEvent('botDestroyed', {
                detail: { botId, botType: bot.botType },
              })
            );
          }

          break; // This laser is now exploded, move to next
        }
      }
    }
  }

  // detect bot laser hits on other bots (bot-on-bot combat)
  if (bots && bots.size > 0 && botLasersMap && botLasersMap.size > 0) {
    for (const [shootingBotId, lasers] of botLasersMap.entries()) {
      const shootingBot = bots.get(shootingBotId);
      if (!shootingBot || shootingBot.ship.exploding) {
        continue;
      }

      for (let j = lasers.length - 1; j >= 0; j--) {
        const laser = lasers[j];
        if (laser.explodeTime > 0) {
          continue;
        }

        for (const [targetBotId, targetBot] of bots.entries()) {
          if (targetBotId === shootingBotId || targetBot.ship.exploding) {
            continue;
          }

          if (targetBot.ship.blinkCount > 0 || targetBot.spawnProtectedUntil > Date.now()) {
            continue;
          }

          if (isLaserHitBot(laser, targetBot)) {
            botManager.botTakeDamage(targetBot, SHIP_BOT_DAMAGE);
            laser.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

            if (targetBot.ship.exploding) {
              window.dispatchEvent(
                new CustomEvent('botDestroyed', {
                  detail: {
                    botId: targetBotId,
                    botType: targetBot.botType,
                    killedBy: 'bot_laser',
                  },
                })
              );
            }

            break;
          }
        }
      }
    }
  }

  return score;
}

export function detectLaserPlayerCollisions(currShip: Ship, otherPlayers: Player[]): number {
  if (!otherPlayers || otherPlayers.length === 0) {
    return 0;
  }

  let score = 0;

  // Check each laser for player hits
  for (let j = currShip.lasers.length - 1; j >= 0; j--) {
    const laser = currShip.lasers[j];

    // Skip lasers that are already exploding
    if (laser.explodeTime > 0) {
      continue;
    }

    // Check each other player
    for (const player of otherPlayers) {
      // Skip exploding players
      if (player.ship.exploding) {
        continue;
      }

      // Skip bot players (they're handled by detectLaserHits)
      if (player.isBot) {
        continue;
      }

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0 && player.ship.blinkOn) {
        continue;
      }

      // Check collision using distance and radius
      const distance = laser.position.distance(player.ship.position);
      const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        // Handle player damage using health system (same as ship system)
        const damage = 15; // Laser damage
        const currentHealth = player.ship.health || 100;
        const newHealth = Math.max(0, currentHealth - damage);

        // Update player health
        player.ship.health = newHealth;
        player.ship.lastDamageTime = Date.now();

        // Activate laser explosion
        laser.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // Play hit sound
        Asteroid.fxHit.play();

        // Check if player should die from health loss
        if (newHealth <= 0) {
          if (player.lives > 0) {
            // Player still has lives, lose a life and respawn
            player.lives--;
            player.ship.exploding = true;
            player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
          } else {
            // No lives remaining, player is permanently dead and should be removed
            player.ship.exploding = true;
            player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

            // Remove player from game after explosion animation
            setTimeout(
              () => {
                const multiplayerManager = GameController.getInstance().getMultiplayerManager();
                if (multiplayerManager) {
                  multiplayerManager.removePlayer(player.id);
                }
              },
              Math.ceil(LASER_EXPLODE_DUR * 1000)
            ); // Remove after explosion duration
          }
        }

        // Award points for player hit (similar to asteroid destruction)
        score += 50;

        // Only handle one hit per laser per frame
        break;
      }
    }
  }

  return score;
}

export function detectAllPlayerBotCollisions(
  localShip: Ship,
  otherPlayers: Player[],
  bots: Map<string, BotPlayer>
): void {
  if (!bots || bots.size === 0) {
    return;
  }

  // Create a combined list of all players including the local player
  const allPlayers: Array<{ id: string; position: Vector; r: number; isLocal: boolean }> = [
    // Add local player
    {
      id: 'local-player',
      position: localShip.position,
      r: localShip.r,
      isLocal: true,
    },
    // Add other players
    ...otherPlayers.map((player) => ({
      id: player.id,
      position: player.ship.position,
      r: player.ship.r,
      isLocal: false,
    })),
  ];

  // Check each player against each bot
  for (const player of allPlayers) {
    // Skip if player is exploding (for local player, check ship state)
    if (player.isLocal) {
      if (localShip.exploding) {
        continue;
      }
      // Skip invincible local player (blinking)
      if (localShip.blinkCount > 0) {
        continue;
      }
    } else {
      // For other players, check their state
      const otherPlayer = otherPlayers.find((p) => p.id === player.id);
      if (!otherPlayer || otherPlayer.ship.exploding) {
        continue;
      }
      // Skip invincible other players (blinking)
      if (otherPlayer.ship.blinkCount && otherPlayer.ship.blinkCount > 0) {
        continue;
      }
    }

    for (const [botId, bot] of bots.entries()) {
      // Skip exploding bots
      if (bot.ship.exploding) {
        continue;
      }

      // Skip invincible bots (blinking or time-based spawn protection)
      if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
        continue;
      }

      // Calculate distance between player and bot centers
      const distance = player.position.distance(bot.ship.position);
      const collisionThreshold = player.r + bot.ship.r;

      if (distance < collisionThreshold) {
        if (player.isLocal) {
          // Local player collision with bot

          // Deal damage to local ship
          localShip.takeDamage(SHIP_BOT_DAMAGE);

          // Mark bot as exploding
          bot.ship.exploding = true;
          bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

          // Play hit sound
          Asteroid.fxHit.play();

          // Dispatch event to notify bot destruction
          window.dispatchEvent(
            new CustomEvent('botDestroyed', {
              detail: { botId, botType: bot.botType, killedBy: 'local_player_collision' },
            })
          );
        } else {
          // Other player collision with bot
          const otherPlayer = otherPlayers.find((p) => p.id === player.id);
          if (otherPlayer) {
            // Both player and bot are destroyed in the collision
            otherPlayer.ship.exploding = true;
            otherPlayer.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

            // Check if player should be removed (no lives remaining)
            if (otherPlayer.lives <= 0) {
              // Remove player from game after explosion animation
              setTimeout(
                () => {
                  const multiplayerManager = GameController.getInstance().getMultiplayerManager();
                  if (multiplayerManager) {
                    multiplayerManager.removePlayer(otherPlayer.id);
                  }
                },
                Math.ceil(LASER_EXPLODE_DUR * 1000)
              ); // Remove after explosion duration
            }

            bot.ship.exploding = true;
            bot.ship.explodeTime = 60; // 1 second explosion duration

            // Play hit sound
            Asteroid.fxHit.play();

            // Dispatch event to notify bot destruction
            window.dispatchEvent(
              new CustomEvent('botDestroyed', {
                detail: { botId, botType: bot.botType, killedBy: 'other_player_collision' },
              })
            );
          }
        }

        // Only handle one collision per player per frame
        break;
      }
    }
  }
}

export function detectRoidHits(currShip: Ship, currAsteroidBelt: AsteroidBelt): number {
  let score = 0;

  // check for asteroid collisions (when not exploding)
  if (DRAW_ASTEROIDS && !currShip.exploding) {
    // only check when not blinking
    if (currShip.blinkCount === 0) {
      for (let i = 0; i < currAsteroidBelt.roids.length; i++) {
        if (
          currShip.position.distance(currAsteroidBelt.roids[i].position) <
          currShip.r + currAsteroidBelt.roids[i].r
        ) {
          // Deal damage instead of instant death
          currShip.takeDamage(SHIP_ASTEROID_DAMAGE);

          // Never explode the ship here - let takeDamage handle life loss and respawn
          // The ship will only explode when it's actually dead (no lives remaining)

          Asteroid.fxHit.play();
          score = currAsteroidBelt.destroyRoid(i);
        }
      }
    }
  }
  return score;
}

export function detectBotAsteroidCollisions(
  bots: Map<string, BotPlayer>,
  currAsteroidBelt: AsteroidBelt
): void {
  if (!bots || bots.size === 0) {
    return;
  }

  const roids = currAsteroidBelt.roids;
  if (roids.length === 0) {
    return;
  }

  // Check each bot for asteroid collisions
  for (const [botId, bot] of bots.entries()) {
    // Skip exploding bots
    if (bot.ship.exploding) {
      continue;
    }

    // Skip invincible bots (blinking or time-based spawn protection)
    if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
      continue;
    }

    // Check collision with each asteroid
    for (let i = 0; i < roids.length; i++) {
      const distance = bot.ship.position.distance(roids[i].position);
      const collisionThreshold = bot.ship.r + roids[i].r;

      if (distance < collisionThreshold) {
        // Deal damage to bot instead of instant death
        bot.ship.health -= SHIP_ASTEROID_DAMAGE;
        bot.ship.lastDamageTime = FPS;
        bot.ship.healthRegenTimer = Math.ceil(SHIP_HEALTH_REGEN_DELAY * FPS);

        // If bot health reaches 0, trigger explosion without affecting lives
        if (bot.ship.health <= 0) {
          bot.ship.health = 0;
          bot.ship.exploding = true;
          bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

          // Start respawn timer and position so it respawns after explosion
          bot.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;
          bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
        }

        // Play hit sound
        Asteroid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: {
              botId,
              botType: bot.botType,
              killedBy: 'asteroid_collision',
            },
          })
        );

        // Only handle one collision per bot to avoid multiple simultaneous destructions
        break;
      }
    }
  }
}

export function isHit(laser: Laser, roid: Asteroid): boolean {
  if (laser.explodeTime === 0 && roid.position.distance(laser.position) < roid.r) {
    return true;
  }
  return false;
}

export function isLaserHitBot(laser: Laser, bot: BotPlayer): boolean {
  // Skip lasers that are already exploding
  if (laser.explodeTime > 0) {
    return false;
  }

  // Calculate distance between laser and bot center
  const distance = bot.ship.position.distance(laser.position);

  // Make collision detection more forgiving - use a larger hit area
  // This accounts for the fact that lasers are moving and bots are small
  const hitRadius = bot.ship.r + 5; // Add 5 pixels of tolerance

  return distance < hitRadius;
}

// Legacy bot bullet helpers removed in favor of Laser usage

export function detectShipToShipCollisions(
  currShip: Ship,
  bots: Map<string, BotPlayer>,
  otherPlayers?: Player[]
): number {
  let score = 0;

  // Skip collision detection if ship is exploding
  if (currShip.exploding) {
    return score;
  }

  // Skip collision detection if current ship is invincible (blinking or spawn protection)
  if (currShip.blinkCount > 0) {
    return score;
  }

  // Check for ship-to-ship collisions with bots
  for (const [botId, bot] of bots.entries()) {
    // Skip exploding bots
    if (bot.ship.exploding) {
      continue;
    }

    // Check collision with ship
    const distance = bot.ship.position.distance(currShip.position);
    const collisionThreshold = currShip.r + bot.ship.r;

    if (distance < collisionThreshold) {
      // Skip invincible bots (blinking or time-based spawn protection)
      if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
        continue;
      }

      // Check if we're in debug mode
      const isDevelopment = import.meta.env?.DEV === true || import.meta.env.MODE === 'development';

      if (DEBUG || isDevelopment) {
        // DEBUG MODE: Player is invincible, only bot is destroyed

        // Destroy the bot
        bot.ship.exploding = true;
        bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

        // Add points for destroying a bot
        score += 200;

        // Play hit sound
        Asteroid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: { botId, botType: bot.botType, killedBy: 'ship_collision' },
          })
        );
      } else {
        // REGULAR MODE: Both ships are destroyed

        // Destroy the bot
        bot.ship.exploding = true;
        bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

        // Check collision cooldown before applying damage to player ship
        if (currShip.canTakeCollisionDamage()) {
          // Destroy the current player ship
          currShip.takeDamage(SHIP_BOT_DAMAGE);
        }

        // Never explode the ship here - let takeDamage handle life loss and respawn
        // The ship will only explode when it's actually dead (no lives remaining)

        // Play hit sound
        Asteroid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: { botId, botType: bot.botType, killedBy: 'ship_collision' },
          })
        );
      }

      // Only handle one collision at a time to avoid multiple simultaneous destructions
      break;
    }
  }

  // Check for ship-to-ship collisions with other players
  if (otherPlayers && otherPlayers.length > 0) {
    for (const player of otherPlayers) {
      // Skip exploding or bot players
      if (player.ship.exploding || player.isBot) {
        continue;
      }

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0) {
        continue;
      }

      // Calculate distance between ship centers
      const distance = currShip.position.distance(player.ship.position);
      const collisionThreshold = currShip.r + player.ship.r;

      if (distance < collisionThreshold) {
        // Check if we're in debug mode
        if (DEBUG || isDevelopmentMode()) {
          // DEBUG MODE: Player is invincible, only other player is destroyed

          // Destroy the other player
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

          // Check collision cooldown before applying damage to current player ship
          if (currShip.canTakeCollisionDamage()) {
            // Destroy the current player ship
            currShip.takeDamage(SHIP_BOT_DAMAGE);
          }

          // Add points for destroying another player
          score += 300;

          // Play hit sound
          Asteroid.fxHit.play();
        } else {
          // REGULAR MODE: Both ships are destroyed

          // Destroy the other player
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

          // Check collision cooldown before applying damage to current player ship
          if (currShip.canTakeCollisionDamage()) {
            // Destroy the current player ship
            currShip.takeDamage(SHIP_BOT_DAMAGE);
          }

          // Play hit sound
          Asteroid.fxHit.play();
        }

        // Only handle one collision at a time
        break;
      }
    }
  }

  return score;
}

export function detectBotShipCollisions(currShip: Ship, bots: Map<string, BotPlayer>): void {
  if (!bots || bots.size === 0) {
    return;
  }
  if (currShip.exploding) {
    return;
  }

  // Skip collision detection if current ship is invincible (blinking or spawn protection)
  if (currShip.blinkCount > 0) {
    return;
  }

  // Check each bot for ship collisions
  for (const [botId, bot] of bots.entries()) {
    // Skip exploding bots
    if (bot.ship.exploding) {
      continue;
    }

    // Check collision with ship
    const distance = bot.ship.position.distance(currShip.position);
    const collisionThreshold = bot.ship.r + currShip.r;

    if (distance < collisionThreshold) {
      // Skip invincible bots (blinking or time-based spawn protection)
      if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
        continue;
      }

      // Deal damage to ship
      if (currShip.canTakeCollisionDamage()) {
        currShip.takeDamage(SHIP_BOT_DAMAGE);
      }

      // Never explode the ship here - let takeDamage handle life loss and respawn
      // The ship will only explode when it's actually dead (no lives remaining)

      // Mark bot as exploding
      bot.ship.exploding = true;
      bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

      // Play hit sound
      Asteroid.fxHit.play();

      // Dispatch event to notify bot destruction
      window.dispatchEvent(
        new CustomEvent('botDestroyed', {
          detail: {
            botId,
            botType: bot.botType,
            killedBy: 'ship_collision',
          },
        })
      );

      // Only handle one collision per frame to avoid multiple simultaneous destructions
      break;
    }
  }
}

export function detectPlayerLaserShipCollisions(_localShip: Ship, otherPlayers: Player[]): number {
  if (!otherPlayers || otherPlayers.length === 0) {
    return 0;
  }
  // No local simulation of other players' lasers
  return 0;
}

export function detectBotLaserPlayerCollisions(
  otherPlayers: Player[],
  bots: Map<string, BotPlayer>
): number {
  if (!otherPlayers || otherPlayers.length === 0 || !bots || bots.size === 0) {
    return 0;
  }

  const score = 0;
  const botManager = BotManager.getInstance();
  const botLasersMap = botManager.getBotLasers();

  if (botLasersMap.size === 0) {
    return 0;
  }

  // Check each bot's lasers against each player
  for (const [botId, lasers] of botLasersMap.entries()) {
    const bot = bots.get(botId);
    if (!bot || bot.ship.exploding) {
      continue;
    }

    for (const laser of lasers) {
      // Skip lasers that are already exploding
      if (laser.explodeTime > 0) {
        continue;
      }

      // Check each player
      for (const player of otherPlayers) {
        // Skip exploding or bot players
        if (player.ship.exploding || player.isBot) {
          continue;
        }

        // Skip invincible players (blinking)
        if (player.ship.blinkCount && player.ship.blinkCount > 0) {
          continue;
        }

        // Check collision using distance and radius
        const distance = laser.position.distance(player.ship.position);
        const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

        if (distance < collisionThreshold) {
          // Handle player damage using health system (same as player laser system)
          const damage = 15; // Bot laser damage
          const currentHealth = player.ship.health || 100;
          const newHealth = Math.max(0, currentHealth - damage);

          // Update player health
          player.ship.health = newHealth;
          player.ship.lastDamageTime = Date.now();

          // Activate laser explosion
          laser.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

          // Play hit sound
          Asteroid.fxHit.play();

          // Check if player should die from health loss
          if (newHealth <= 0) {
            if (player.lives > 0) {
              // Player still has lives, lose a life and respawn
              player.lives--;
              player.ship.exploding = true;
              player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
            } else {
              // No lives remaining, player is permanently dead and should be removed
              player.ship.exploding = true;
              player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

              // Remove player from game after explosion animation
              setTimeout(
                () => {
                  const multiplayerManager = GameController.getInstance().getMultiplayerManager();
                  if (multiplayerManager) {
                    multiplayerManager.removePlayer(player.id);
                  }
                },
                Math.ceil(LASER_EXPLODE_DUR * 1000)
              ); // Remove after explosion duration
            }
          }

          // Only handle one hit per laser per frame
          break;
        }
      }
    }
  }

  return score;
}
