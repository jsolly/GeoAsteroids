import {
  BOT_ASTEROID_DAMAGE,
  BOT_HEALTH_REGEN_DELAY,
  BOT_LASER_DAMAGE,
  DEBUG,
  DRAW_ASTEROIDS,
  FPS,
  LASER_EXPLODE_DUR,
  SHIP_ASTEROID_DAMAGE,
  SHIP_BOT_DAMAGE,
} from '../constants';
import { GameController } from '../core/gameController.ts';
import { Asteroid, type AsteroidBelt } from '../entities/asteroid/Asteroid.ts';
import { BotManager } from '../entities/bot/botManager.ts';
// Simple logging - removed complex logger dependency
import type { BotPlayer } from '../entities/bot/types.ts';
import type { Player } from '../entities/player/types.ts';
import type { Laser, Ship } from '../entities/ship/Ship.ts';
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
          console.debug('BOT_COLLISION_SKIP', 'Skipping invincible bot', {
            botId,
            botType: bot.botType,
            blinkCount: bot.ship.blinkCount,
            spawnProtectedUntil: bot.spawnProtectedUntil,
            currentTime: Date.now(),
            isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
          });
          continue;
        }

        // Add debug logging for non-invincible bots
        console.debug('BOT_COLLISION_CHECK', 'Checking collision with non-invincible bot', {
          botId,
          botType: bot.botType,
          blinkCount: bot.ship.blinkCount,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
          health: bot.ship.health,
          lives: bot.lives,
        });

        if (isLaserHitBot(laser, bot)) {
          console.info('BOT_COLLISION', 'Bot hit by laser!', {
            botId,
            botType: bot.botType,
            laserPos: { x: laser.position.x, y: laser.position.y },
            botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
            distance: bot.ship.position.distance(laser.position),
            botRadius: bot.ship.r,
            botHealth: bot.ship.health,
            damage: BOT_LASER_DAMAGE,
          });

          // Deal damage to bot (same logic as botTakeDamage method)
          botManager.botTakeDamage(bot, BOT_LASER_DAMAGE);

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

            console.info('BOT_COLLISION_SUCCESS', 'Bot destroyed successfully', {
              botId,
              botType: bot.botType,
              newScore: score,
              botState: {
                exploding: bot.ship.exploding,
                explodeTime: bot.ship.explodeTime,
              },
            });
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
            console.info('BOT_VS_BOT_COLLISION', 'Bot hit by another bot laser!', {
              shootingBotId,
              shootingBotName: shootingBot.name,
              targetBotId,
              targetBotName: targetBot.name,
              laserPos: { x: laser.position.x, y: laser.position.y },
              targetBotPos: {
                x: targetBot.ship.position.x,
                y: targetBot.ship.position.y,
              },
              distance: targetBot.ship.position.distance(laser.position),
              targetBotRadius: targetBot.ship.r,
              damage: BOT_LASER_DAMAGE,
            });

            botManager.botTakeDamage(targetBot, BOT_LASER_DAMAGE);
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
    console.debug('LASER_COLLISION_DEBUG', 'No other players to check for collisions');
    return 0;
  }

  console.debug('LASER_COLLISION_DEBUG', 'Processing laser collisions with players', {
    totalPlayers: otherPlayers.length,
    playerIds: otherPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,

      exploding: p.ship.exploding,
    })),
  });

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
      console.debug('LASER_COLLISION_DEBUG', 'Checking player for laser hit', {
        playerId: player.id,
        playerName: player.name,
        isBot: player.isBot,
        exploding: player.ship.exploding,
        blinkCount: player.ship.blinkCount,
        blinkOn: player.ship.blinkOn,
        position: player.ship.position,
        laserPosition: laser.position,
      });

      // Skip exploding players
      if (player.ship.exploding) {
        console.debug('LASER_COLLISION_DEBUG', 'Skipping exploding player', {
          playerId: player.id,
          playerName: player.name,
          exploding: player.ship.exploding,
        });
        continue;
      }

      // Skip bot players (they're handled by detectLaserHits)
      if (player.isBot) {
        console.debug('LASER_COLLISION_DEBUG', 'Skipping bot player', {
          playerId: player.id,
          playerName: player.name,
        });
        continue;
      }

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0 && player.ship.blinkOn) {
        console.debug('🎯 LASER_PLAYER_INVINCIBLE', 'Skipping invincible player', {
          playerId: player.id,
          playerName: player.name,
          blinkCount: player.ship.blinkCount,
          blinkOn: player.ship.blinkOn,
        });
        continue;
      }

      // Check collision using distance and radius
      const distance = laser.position.distance(player.ship.position);
      const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        console.info('🎯 LASER_PLAYER_HIT', 'Laser hit other player!', {
          playerId: player.id,
          playerName: player.name,
          playerPos: { x: player.ship.position.x, y: player.ship.position.y },
          laserPos: { x: laser.position.x, y: laser.position.y },
          distance,
          collisionThreshold,
          playerRadius: player.ship.r,
          playerHealth: player.ship.health,
          damage: 15, // Laser damage
        });

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

        console.info('🎯 PLAYER_DAMAGED', 'Player took laser damage', {
          playerId: player.id,
          playerName: player.name,
          oldHealth: currentHealth,
          newHealth: newHealth,
          damage: damage,
          remainingLives: player.lives,
        });

        // Check if player should die from health loss
        if (newHealth <= 0) {
          if (player.lives > 0) {
            // Player still has lives, lose a life and respawn
            player.lives--;
            player.ship.exploding = true;
            player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

            console.info('💔 PLAYER_LIFE_LOST', 'Player lost a life from laser hit', {
              playerId: player.id,
              playerName: player.name,
              remainingLives: player.lives,
              explodeTime: player.ship.explodeTime,
            });
          } else {
            // No lives remaining, player is permanently dead and should be removed
            player.ship.exploding = true;
            player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

            console.info('💀 PLAYER_KILLED', 'Player killed permanently by laser', {
              playerId: player.id,
              playerName: player.name,
            });

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
        console.info('PLAYER_VS_BOT_COLLISION', 'Player vs Bot collision detected!', {
          playerId: player.id,
          isLocalPlayer: player.isLocal,
          playerPos: { x: player.position.x, y: player.position.y },
          botId,
          botType: bot.botType,
          botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
          distance,
          collisionThreshold,
          playerRadius: player.r,
          botRadius: bot.ship.r,
        });

        if (player.isLocal) {
          // Local player collision with bot
          console.info('🤖 LOCAL_PLAYER_VS_BOT', 'Local player hit by bot!', {
            botId,
            botType: bot.botType,
            shipHealth: localShip.health,
            damage: SHIP_BOT_DAMAGE,
          });

          // Deal damage to local ship
          localShip.takeDamage(SHIP_BOT_DAMAGE);

          // Mark bot as exploding
          bot.ship.exploding = true;
          bot.ship.explodeTime = 60; // 1 second explosion duration

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

        console.info('PLAYER_VS_BOT_COLLISION_SUCCESS', 'Player vs Bot collision handled', {
          playerId: player.id,
          isLocalPlayer: player.isLocal,
          botId,
          botType: bot.botType,
        });

        // Only handle one collision per player per frame
        break;
      }
    }
  }
}

export function detectRoidHits(currShip: Ship, currAsteroidBelt: AsteroidBelt): number {
  let score = 0;

  // Check if we're in debug mode or development mode
  const isDevelopment =
    import.meta.env.MODE === 'development' && import.meta.env.VITE_DISABLE_INVINCIBILITY !== 'true';

  // console.info('COLLISION_DEBUG', 'DEBUG constant value', { value: DEBUG, type: typeof DEBUG });
  // console.info('COLLISION_DEBUG', 'Development mode check', { isDevelopment });

  // In debug mode, collisions are detected and damage is dealt, but ship doesn't die
  const isDebugMode = DEBUG || isDevelopment;

  // check for asteroid collisions (when not exploding)
  if (DRAW_ASTEROIDS && !currShip.exploding) {
    // only check when not blinking
    if (currShip.blinkCount === 0) {
      for (let i = 0; i < currAsteroidBelt.roids.length; i++) {
        if (
          currShip.position.distance(currAsteroidBelt.roids[i].position) <
          currShip.r + currAsteroidBelt.roids[i].r
        ) {
          console.info('💥 ASTEROID_COLLISION', 'Ship hit asteroid!', {
            shipPos: { x: currShip.position.x, y: currShip.position.y },
            asteroidPos: {
              x: currAsteroidBelt.roids[i].position.x,
              y: currAsteroidBelt.roids[i].position.y,
            },
            shipRadius: currShip.r,
            asteroidRadius: currAsteroidBelt.roids[i].r,
            distance: currShip.position.distance(currAsteroidBelt.roids[i].position),
            threshold: currShip.r + currAsteroidBelt.roids[i].r,
            shipHealth: currShip.health,
            damage: SHIP_ASTEROID_DAMAGE,
            debugMode: isDebugMode,
          });

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

  // console.info('BOT_ASTEROID_COLLISION_DEBUG', 'Checking bot-asteroid collisions', {
  //   botCount: bots.size,
  //   asteroidCount: roids.length,
  //   bots: Array.from(bots.values()).map(bot => ({
  //     id: bot.id,
  //     name: bot.name,
  //     dead: bot.ship.dead,
  //     exploding: bot.ship.exploding,
  //     position: { x: bot.ship.position.x, y: bot.ship.position.y }
  //   }))
  // });

  // Check each bot for asteroid collisions
  for (const [botId, bot] of bots.entries()) {
    // Skip exploding bots
    if (bot.ship.exploding) {
      continue;
    }

    // Skip invincible bots (blinking or time-based spawn protection)
    if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
      console.debug(
        'BOT_ASTEROID_COLLISION_SKIP',
        'Skipping invincible bot for asteroid collision',
        {
          botId,
          botType: bot.botType,
          blinkCount: bot.ship.blinkCount,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
          isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        }
      );
      continue;
    }

    // Add debug logging for non-invincible bots
    console.debug(
      'BOT_ASTEROID_COLLISION_CHECK',
      'Checking asteroid collision with non-invincible bot',
      {
        botId,
        botType: bot.botType,
        blinkCount: bot.ship.blinkCount,
        spawnProtectedUntil: bot.spawnProtectedUntil,
        currentTime: Date.now(),
        health: bot.ship.health,
      }
    );

    // Check collision with each asteroid
    for (let i = 0; i < roids.length; i++) {
      const distance = bot.ship.position.distance(roids[i].position);
      const collisionThreshold = bot.ship.r + roids[i].r;

      if (distance < collisionThreshold) {
        // Skip invincible bots (blinking or time-based spawn protection)
        if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
          continue;
        }

        console.info('BOT_ASTEROID_COLLISION', 'Bot hit asteroid!', {
          botId,
          botType: bot.botType,
          botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
          asteroidPos: { x: roids[i].position.x, y: roids[i].position.y },
          distance,
          collisionThreshold,
          botRadius: bot.ship.r,
          asteroidRadius: roids[i].r,
          botHealth: bot.ship.health,
          damage: BOT_ASTEROID_DAMAGE,
        });

        // Deal damage to bot instead of instant death
        bot.ship.health -= BOT_ASTEROID_DAMAGE;
        bot.ship.lastDamageTime = FPS;
        bot.ship.healthRegenTimer = Math.ceil(BOT_HEALTH_REGEN_DELAY * FPS);

        // Check if bot should lose a life
        if (bot.ship.health <= 0) {
          bot.ship.health = 0;
          bot.lives--;

          if (bot.lives <= 0) {
            // Bot is dead, mark as exploding
            bot.ship.exploding = true;
            bot.ship.explodeTime = 60; // 1 second explosion duration
          } else {
            // Bot still has lives, start explosion and respawn sequence
            bot.ship.exploding = true;
            bot.ship.explodeTime = 30; // 0.5 second explosion duration

            // Start respawn timer
            bot.respawnTimer = 300; // 5 seconds at 60 FPS
            bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
          }
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

        console.info('BOT_ASTEROID_COLLISION_SUCCESS', 'Bot destroyed by asteroid collision', {
          botId,
          botType: bot.botType,
          asteroidIndex: i,
        });

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

  // Log collision detection details for debugging
  if (distance < hitRadius + 10) {
    // Log when close to hitting
    console.info('BOT_COLLISION_CHECK', 'Bot collision check details', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      laserPos: { x: laser.position.x, y: laser.position.y },
      botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
      distance,
      botRadius: bot.ship.r,
      hitRadius,
      hit: distance < hitRadius,
      laserExplodeTime: laser.explodeTime,
    });
  }

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

  // Check for ship-to-ship collisions with bots
  for (const [botId, bot] of bots.entries()) {
    // Skip exploding bots
    if (bot.ship.exploding) {
      continue;
    }

    // Calculate distance between ship and bot centers
    const distance = currShip.position.distance(bot.ship.position);
    const collisionThreshold = currShip.r + bot.ship.r;

    if (distance < collisionThreshold) {
      // Skip invincible bots (blinking or time-based spawn protection)
      if (bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now()) {
        continue;
      }

      console.info('SHIP_VS_SHIP_COLLISION', 'Ship collision detected!', {
        shipPos: { x: currShip.position.x, y: currShip.position.y },
        botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
        distance,
        collisionThreshold,
        shipRadius: currShip.r,
        botRadius: bot.ship.r,
        botId,
        botType: bot.botType,
      });

      // Check if we're in debug mode
      const isDevelopment =
        (import.meta.env?.DEV === true || import.meta.env?.MODE === 'development') &&
        import.meta.env?.VITE_INVINCIBLE === 'true';

      if (DEBUG || isDevelopment) {
        // DEBUG MODE: Player is invincible, only bot is destroyed
        console.info(
          'SHIP_VS_SHIP_COLLISION',
          'DEBUG MODE: Player ship is invincible, destroying bot',
          {
            botId,
            botType: bot.botType,
          }
        );

        // Destroy the bot
        bot.ship.exploding = true;
        bot.ship.explodeTime = 60; // 1 second explosion duration

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

        console.info(
          'SHIP_VS_SHIP_COLLISION_SUCCESS',
          'Bot destroyed by ship collision in debug mode',
          {
            botId,
            botType: bot.botType,
            scoreAwarded: 200,
          }
        );
      } else {
        // REGULAR MODE: Both ships are destroyed
        console.info('SHIP_VS_SHIP_COLLISION', 'REGULAR MODE: Both ships destroyed in collision', {
          botId,
          botType: bot.botType,
        });

        // Destroy the bot
        bot.ship.exploding = true;
        bot.ship.explodeTime = 60; // 1 second explosion duration

        // Check collision cooldown before applying damage to player ship
        if (currShip.canTakeCollisionDamage()) {
          // Destroy the current player ship
          currShip.takeDamage(SHIP_BOT_DAMAGE);
        } else {
          console.info('SHIP_VS_SHIP_COLLISION', 'Collision damage skipped due to cooldown', {
            botId,
            botType: bot.botType,
            timeSinceLastCollision: Date.now() - currShip.lastCollisionTime,
          });
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

        console.info('SHIP_VS_SHIP_COLLISION_SUCCESS', 'Both ships destroyed in collision', {
          botId,
          botType: bot.botType,
        });
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
        console.info('SHIP_VS_PLAYER_COLLISION', 'Player collision detected!', {
          shipPos: { x: currShip.position.x, y: currShip.position.y },
          playerPos: { x: player.ship.position.x, y: player.ship.position.y },
          distance,
          collisionThreshold,
          shipRadius: currShip.r,
          playerRadius: player.ship.r,
          playerId: player.id,
          playerName: player.name,
        });

        // Check if we're in debug mode
        const isDevelopment =
          (import.meta.env?.DEV === true || import.meta.env?.MODE === 'development') &&
          import.meta.env?.VITE_INVINCIBLE === 'true';

        if (DEBUG || isDevelopment) {
          // DEBUG MODE: Player is invincible, only other player is destroyed
          console.info(
            'SHIP_VS_PLAYER_COLLISION',
            'DEBUG MODE: Player ship is invincible, destroying other player',
            {
              playerId: player.id,
              playerName: player.name,
            }
          );

          // Destroy the other player
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

          // Check collision cooldown before applying damage to current player ship
          if (currShip.canTakeCollisionDamage()) {
            // Destroy the current player ship
            currShip.takeDamage(SHIP_BOT_DAMAGE);
          } else {
            console.info('SHIP_VS_PLAYER_COLLISION', 'Collision damage skipped due to cooldown', {
              playerId: player.id,
              playerName: player.name,
              timeSinceLastCollision: Date.now() - currShip.lastCollisionTime,
            });
          }

          // Add points for destroying another player
          score += 300;

          // Play hit sound
          Asteroid.fxHit.play();

          console.info(
            'SHIP_VS_PLAYER_COLLISION_SUCCESS',
            'Other player destroyed by ship collision in debug mode',
            {
              playerId: player.id,
              playerName: player.name,
              scoreAwarded: 300,
            }
          );
        } else {
          // REGULAR MODE: Both ships are destroyed
          console.info(
            'SHIP_VS_PLAYER_COLLISION',
            'REGULAR MODE: Both players destroyed in collision',
            {
              playerId: player.id,
              playerName: player.name,
            }
          );

          // Destroy the other player
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

          // Check collision cooldown before applying damage to current player ship
          if (currShip.canTakeCollisionDamage()) {
            // Destroy the current player ship
            currShip.takeDamage(SHIP_BOT_DAMAGE);
          } else {
            console.info('SHIP_VS_PLAYER_COLLISION', 'Collision damage skipped due to cooldown', {
              playerId: player.id,
              playerName: player.name,
              timeSinceLastCollision: Date.now() - currShip.lastCollisionTime,
            });
          }

          // Play hit sound
          Asteroid.fxHit.play();

          console.info('SHIP_VS_PLAYER_COLLISION_SUCCESS', 'Both players destroyed in collision', {
            playerId: player.id,
            playerName: player.name,
          });
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

      console.info('🤖 BOT_SHIP_COLLISION', 'Ship hit by bot!', {
        botId,
        botType: bot.botType,
        botPos: { x: bot.ship.position.x, y: bot.ship.position.y },
        shipPos: { x: currShip.position.x, y: currShip.position.y },
        distance,
        collisionThreshold,
        botRadius: bot.ship.r,
        shipRadius: currShip.r,
        shipHealth: currShip.health,
        damage: SHIP_BOT_DAMAGE,
      });

      // Deal damage to ship
      if (currShip.canTakeCollisionDamage()) {
        currShip.takeDamage(SHIP_BOT_DAMAGE);
      } else {
        console.info('BOT_SHIP_COLLISION', 'Collision damage skipped due to cooldown', {
          botId,
          botType: bot.botType,
          timeSinceLastCollision: Date.now() - currShip.lastCollisionTime,
        });
      }

      // Never explode the ship here - let takeDamage handle life loss and respawn
      // The ship will only explode when it's actually dead (no lives remaining)

      // Mark bot as exploding
      bot.ship.exploding = true;
      bot.ship.explodeTime = 60; // 1 second explosion duration

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

      console.info('BOT_SHIP_COLLISION_SUCCESS', 'Bot destroyed by ship collision', {
        botId,
        botType: bot.botType,
        shipHealth: currShip.health,
      });

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
          console.info('🎯 BOT_LASER_PLAYER_HIT', 'Bot laser hit other player!', {
            botId,
            botType: bot.botType,
            playerId: player.id,
            playerName: player.name,
            playerPos: { x: player.ship.position.x, y: player.ship.position.y },
            laserPos: { x: laser.position.x, y: laser.position.y },
            distance,
            collisionThreshold,
            playerRadius: player.ship.r,
          });

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

          console.info('🎯 BOT_LASER_PLAYER_DAMAGED', 'Player took bot laser damage', {
            botId,
            botType: bot.botType,
            playerId: player.id,
            playerName: player.name,
            oldHealth: currentHealth,
            newHealth: newHealth,
            damage: damage,
            remainingLives: player.lives,
          });

          // Check if player should die from health loss
          if (newHealth <= 0) {
            if (player.lives > 0) {
              // Player still has lives, lose a life and respawn
              player.lives--;
              player.ship.exploding = true;
              player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

              console.info(
                '💔 BOT_LASER_PLAYER_LIFE_LOST',
                'Player lost a life from bot laser hit',
                {
                  botId,
                  botType: bot.botType,
                  playerId: player.id,
                  playerName: player.name,
                  remainingLives: player.lives,
                  explodeTime: player.ship.explodeTime,
                }
              );
            } else {
              // No lives remaining, player is permanently dead and should be removed
              player.ship.exploding = true;
              player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

              console.info('💀 BOT_LASER_PLAYER_KILLED', 'Player killed permanently by bot laser', {
                botId,
                botType: bot.botType,
                playerId: player.id,
                playerName: player.name,
              });

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
