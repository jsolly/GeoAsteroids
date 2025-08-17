import { DEBUG } from './constants.js';
import { IBotPlayer, IBotBullet } from './types/multiplayer.js';
import { RoidBelt, Roid } from './asteroids.js';
import { logInfo } from './logger.js';
import { Ship, Laser } from './ship.js';

// Test DEBUG constant at import time
// console.log('🔍 COLLISIONS: DEBUG constant imported as:', DEBUG, 'Type:', typeof DEBUG);

function detectLaserHits(
  currRoidBelt: RoidBelt,
  currShip: Ship,
  bots?: Map<string, IBotPlayer>,
  botBullets?: Map<string, IBotBullet>,
): number {
  const roids = currRoidBelt.roids;
  let score = 0;

  // detect laser hits on asteroids
  for (let j = currShip.lasers.length - 1; j >= 0; j--) {
    for (let i = roids.length - 1; i >= 0; i--) {
      // detect hits
      if (isHit(currShip.lasers[j], roids[i])) {
        // remove asteroid and activate laser explosion
        Roid.fxHit.play();
        score = currRoidBelt.destroyRoid(i);
        currShip.updateLaserExplodeTime(j);
      }
    }
  }

  // detect bot bullet hits on asteroids (if bot bullets are provided)
  if (botBullets && botBullets.size > 0) {
    for (const [bulletId, bullet] of botBullets.entries()) {
      for (let i = roids.length - 1; i >= 0; i--) {
        if (isBotBulletHit(bullet, roids[i])) {
          logInfo('BOT_BULLET_COLLISION', 'Bot bullet hit asteroid!', {
            bulletId,
            botId: bullet.botId,
            asteroidIndex: i,
            bulletPos: { x: bullet.position.x, y: bullet.position.y },
            asteroidPos: { x: roids[i].position.x, y: roids[i].position.y },
            distance: roids[i].position.distance(bullet.position),
            asteroidRadius: roids[i].r,
          });

          // remove asteroid and play hit sound
          Roid.fxHit.play();
          score = currRoidBelt.destroyRoid(i);

          // Remove the bullet that hit the asteroid
          botBullets.delete(bulletId);

          logInfo(
            'BOT_BULLET_COLLISION_SUCCESS',
            'Asteroid destroyed by bot bullet',
            {
              bulletId,
              botId: bullet.botId,
              asteroidIndex: i,
              newScore: score,
              remainingBullets: botBullets.size,
            },
          );

          break; // This bullet is now destroyed, move to next bullet
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
        // Skip dead or exploding bots
        if (bot.dead || bot.exploding) {
          continue;
        }

        if (isLaserHitBot(laser, bot)) {
          logInfo('BOT_COLLISION', 'Bot hit by laser!', {
            botId,
            botType: bot.botType,
            laserPos: { x: laser.position.x, y: laser.position.y },
            botPos: { x: bot.position.x, y: bot.position.y },
            distance: bot.position.distance(laser.position),
            botRadius: bot.r,
          });

          // Bot hit by laser - mark as dead and explode
          bot.dead = true;
          bot.exploding = true;
          bot.explodeTime = 60; // 1 second explosion duration
          currShip.updateLaserExplodeTime(j);

          // Add points for destroying a bot
          score += 200;

          // Play hit sound
          Roid.fxHit.play();

          // Dispatch event to notify bot destruction
          window.dispatchEvent(
            new CustomEvent('botDestroyed', {
              detail: { botId, botType: bot.botType },
            }),
          );

          logInfo('BOT_COLLISION_SUCCESS', 'Bot destroyed successfully', {
            botId,
            botType: bot.botType,
            newScore: score,
            botState: {
              dead: bot.dead,
              exploding: bot.exploding,
              explodeTime: bot.explodeTime,
            },
          });

          break; // This laser is now exploded, move to next
        }
      }
    }
  }

  // detect bot bullet hits on other bots (bot-on-bot combat)
  if (botBullets && botBullets.size > 0 && bots && bots.size > 0) {
    // logInfo('BOT_VS_BOT_COLLISION_DEBUG', 'Checking bot bullet hits on other bots', {
    //   bulletCount: botBullets.size,
    //   botCount: bots.size,
    //   bullets: Array.from(botBullets.values()).map(bullet => ({
    //     id: bullet.id,
    //     botId: bullet.botId,
    //     position: { x: bullet.position.x, y: bullet.position.y }
    //   }))
    // });

    for (const [bulletId, bullet] of botBullets.entries()) {
      // Skip bullets from bots that are no longer alive
      const shootingBot = bots.get(bullet.botId);
      if (!shootingBot || shootingBot.dead || shootingBot.exploding) {
        continue;
      }

      for (const [targetBotId, targetBot] of bots.entries()) {
        // Skip the bot that fired the bullet and dead/exploding bots
        if (
          targetBotId === bullet.botId ||
          targetBot.dead ||
          targetBot.exploding
        ) {
          continue;
        }

        if (isBotBulletHitBot(bullet, targetBot)) {
          logInfo('BOT_VS_BOT_COLLISION', 'Bot hit by another bot!', {
            bulletId,
            shootingBotId: bullet.botId,
            shootingBotName: shootingBot.name,
            targetBotId,
            targetBotName: targetBot.name,
            bulletPos: { x: bullet.position.x, y: bullet.position.y },
            targetBotPos: { x: targetBot.position.x, y: targetBot.position.y },
            distance: targetBot.position.distance(bullet.position),
            targetBotRadius: targetBot.r,
          });

          // Destroy the target bot
          targetBot.dead = true;
          targetBot.exploding = true;
          targetBot.explodeTime = 30; // 0.5 seconds at 60 FPS

          // Remove the bullet that hit the bot
          botBullets.delete(bulletId);

          logInfo(
            'BOT_VS_BOT_COLLISION_SUCCESS',
            'Bot destroyed by another bot',
            {
              bulletId,
              shootingBotId: bullet.botId,
              shootingBotName: shootingBot.name,
              targetBotId,
              targetBotName: targetBot.name,
              remainingBullets: botBullets.size,
            },
          );

          break; // This bullet is now destroyed, move to next bullet
        }
      }
    }
  }

  return score;
}

function detectRoidHits(currShip: Ship, currRoidBelt: RoidBelt): number {
  let score = 0;

  // Check if we're in debug mode or development mode
  const isDevelopment = import.meta.env.MODE === 'development';

  // logInfo('COLLISION_DEBUG', 'DEBUG constant value', { value: DEBUG, type: typeof DEBUG });
  // logInfo('COLLISION_DEBUG', 'Development mode check', { isDevelopment });

  if (DEBUG || isDevelopment) {
    // logInfo('COLLISION_DEBUG', 'DEBUG/DEV MODE: Ship is invincible to asteroid collisions');
    return 0; // Ship is invincible in debug mode
  } else {
    // logInfo('COLLISION_DEBUG', 'Asteroid collision detection is ENABLED!', {
    //   shipPos: { x: ship.position.x, y: ship.position.y },
    //   shipRadius: ship.r,
    //   asteroidCount: roids.length
    // });
  }

  // check for asteroid collisions (when not exploding)
  if (!currShip.exploding) {
    // only check when not blinking
    if (currShip.blinkCount == 0 && !currShip.dead) {
      for (let i = 0; i < currRoidBelt.roids.length; i++) {
        if (
          currShip.position.distance(currRoidBelt.roids[i].position) <
          currShip.r + currRoidBelt.roids[i].r
        ) {
          console.log('💥 COLLISION DETECTED: Ship hit asteroid!', {
            shipPos: { x: currShip.position.x, y: currShip.position.y },
            asteroidPos: {
              x: currRoidBelt.roids[i].position.x,
              y: currRoidBelt.roids[i].position.y,
            },
            shipRadius: currShip.r,
            asteroidRadius: currRoidBelt.roids[i].r,
            distance: currShip.position.distance(
              currRoidBelt.roids[i].position,
            ),
            threshold: currShip.r + currRoidBelt.roids[i].r,
          });

          // Decrement lives when ship hits asteroid
          currShip.lives--;
          currShip.explode();
          Roid.fxHit.play();
          score = currRoidBelt.destroyRoid(i);
        }
      }
    }
  }
  return score;
}

function detectBotAsteroidCollisions(
  bots: Map<string, IBotPlayer>,
  currRoidBelt: RoidBelt,
): void {
  if (!bots || bots.size === 0) return;

  const roids = currRoidBelt.roids;
  if (roids.length === 0) return;

  // logInfo('BOT_ASTEROID_COLLISION_DEBUG', 'Checking bot-asteroid collisions', {
  //   botCount: bots.size,
  //   asteroidCount: roids.length,
  //   bots: Array.from(bots.values()).map(bot => ({
  //     id: bot.id,
  //     name: bot.name,
  //     dead: bot.dead,
  //     exploding: bot.exploding,
  //     position: { x: bot.position.x, y: bot.position.y }
  //   }))
  // });

  // Check each bot for asteroid collisions
  for (const [botId, bot] of bots.entries()) {
    // Skip dead or exploding bots
    if (bot.dead || bot.exploding) {
      continue;
    }

    // Check collision with each asteroid
    for (let i = 0; i < roids.length; i++) {
      const distance = bot.position.distance(roids[i].position);
      const collisionThreshold = bot.r + roids[i].r;

      if (distance < collisionThreshold) {
        logInfo('BOT_ASTEROID_COLLISION', 'Bot hit asteroid!', {
          botId,
          botType: bot.botType,
          botPos: { x: bot.position.x, y: bot.position.y },
          asteroidPos: { x: roids[i].position.x, y: roids[i].position.y },
          distance,
          collisionThreshold,
          botRadius: bot.r,
          asteroidRadius: roids[i].r,
        });

        // Bot hit asteroid - mark as dead and explode
        bot.dead = true;
        bot.exploding = true;
        bot.explodeTime = 60; // 1 second explosion duration

        // Play hit sound
        Roid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: {
              botId,
              botType: bot.botType,
              killedBy: 'asteroid_collision',
            },
          }),
        );

        logInfo(
          'BOT_ASTEROID_COLLISION_SUCCESS',
          'Bot destroyed by asteroid collision',
          {
            botId,
            botType: bot.botType,
            asteroidIndex: i,
          },
        );

        // Only handle one collision per bot to avoid multiple simultaneous destructions
        break;
      }
    }
  }
}

function isHit(laser: Laser, roid: Roid): boolean {
  if (
    laser.explodeTime == 0 &&
    roid.position.distance(laser.position) < roid.r
  ) {
    return true;
  }
  return false;
}

function isLaserHitBot(laser: Laser, bot: IBotPlayer): boolean {
  // Skip lasers that are already exploding
  if (laser.explodeTime > 0) {
    return false;
  }

  // Calculate distance between laser and bot center
  const distance = bot.position.distance(laser.position);

  // Make collision detection more forgiving - use a larger hit area
  // This accounts for the fact that lasers are moving and bots are small
  const hitRadius = bot.r + 5; // Add 5 pixels of tolerance

  // Log collision detection details for debugging
  if (distance < hitRadius + 10) {
    // Log when close to hitting
    logInfo('BOT_COLLISION_CHECK', 'Bot collision check details', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      laserPos: { x: laser.position.x, y: laser.position.y },
      botPos: { x: bot.position.x, y: bot.position.y },
      distance,
      botRadius: bot.r,
      hitRadius,
      hit: distance < hitRadius,
      laserExplodeTime: laser.explodeTime,
    });
  }

  return distance < hitRadius;
}

function isBotBulletHit(bullet: IBotBullet, roid: Roid): boolean {
  // Calculate distance between bullet and asteroid center
  const distance = roid.position.distance(bullet.position);

  // Check if bullet is within asteroid radius
  return distance < roid.r;
}

function isBotBulletHitBot(bullet: IBotBullet, bot: IBotPlayer): boolean {
  // Calculate distance between bullet and bot center
  const distance = bot.position.distance(bullet.position);

  // Make collision detection more forgiving - use a larger hit area
  // This accounts for the fact that bullets are moving and bots are small
  const hitRadius = bot.r + 5; // Add 5 pixels of tolerance

  // Log collision detection details for debugging
  if (distance < hitRadius + 10) {
    // Log when close to hitting
    logInfo(
      'BOT_VS_BOT_COLLISION_CHECK',
      'Bot bullet collision check details',
      {
        bulletId: bullet.id,
        shooterBotId: bullet.botId,
        targetBotId: bot.id,
        targetBotType: bot.botType,
        bulletPos: { x: bullet.position.x, y: bullet.position.y },
        botPos: { x: bot.position.x, y: bot.position.y },
        distance,
        botRadius: bot.r,
        hitRadius,
        hit: distance < hitRadius,
      },
    );
  }

  return distance < hitRadius;
}

function detectShipToShipCollisions(
  currShip: Ship,
  bots: Map<string, IBotPlayer>,
): number {
  let score = 0;

  // Skip collision detection if ship is exploding or dead
  if (currShip.exploding || currShip.dead) {
    return score;
  }

  // Check for ship-to-ship collisions with bots
  for (const [botId, bot] of bots.entries()) {
    // Skip dead or exploding bots
    if (bot.dead || bot.exploding) {
      continue;
    }

    // Calculate distance between ship and bot centers
    const distance = currShip.position.distance(bot.position);
    const collisionThreshold = currShip.r + bot.r;

    if (distance < collisionThreshold) {
      logInfo('SHIP_VS_SHIP_COLLISION', 'Ship collision detected!', {
        shipPos: { x: currShip.position.x, y: currShip.position.y },
        botPos: { x: bot.position.x, y: bot.position.y },
        distance,
        collisionThreshold,
        shipRadius: currShip.r,
        botRadius: bot.r,
        botId,
        botType: bot.botType,
      });

      // Check if we're in debug mode
      const isDevelopment =
        import.meta.env?.DEV === true ||
        import.meta.env?.MODE === 'development';

      if (DEBUG || isDevelopment) {
        // DEBUG MODE: Player is invincible, only bot is destroyed
        logInfo(
          'SHIP_VS_SHIP_COLLISION',
          'DEBUG MODE: Player ship is invincible, destroying bot',
          {
            botId,
            botType: bot.botType,
          },
        );

        // Destroy the bot
        bot.dead = true;
        bot.exploding = true;
        bot.explodeTime = 60; // 1 second explosion duration

        // Add points for destroying a bot
        score += 200;

        // Play hit sound
        Roid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: { botId, botType: bot.botType, killedBy: 'ship_collision' },
          }),
        );

        logInfo(
          'SHIP_VS_SHIP_COLLISION_SUCCESS',
          'Bot destroyed by ship collision in debug mode',
          {
            botId,
            botType: bot.botType,
            scoreAwarded: 200,
          },
        );
      } else {
        // REGULAR MODE: Both ships are destroyed
        logInfo(
          'SHIP_VS_SHIP_COLLISION',
          'REGULAR MODE: Both ships destroyed in collision',
          {
            botId,
            botType: bot.botType,
          },
        );

        // Destroy the bot
        bot.dead = true;
        bot.exploding = true;
        bot.explodeTime = 60; // 1 second explosion duration

        // Destroy the player ship
        currShip.lives--;
        currShip.explode();

        // Play hit sound
        Roid.fxHit.play();

        // Dispatch event to notify bot destruction
        window.dispatchEvent(
          new CustomEvent('botDestroyed', {
            detail: { botId, botType: bot.botType, killedBy: 'ship_collision' },
          }),
        );

        logInfo(
          'SHIP_VS_SHIP_COLLISION_SUCCESS',
          'Both ships destroyed in collision',
          {
            botId,
            botType: bot.botType,
            playerLivesRemaining: currShip.lives,
          },
        );
      }

      // Only handle one collision at a time to avoid multiple simultaneous destructions
      break;
    }
  }

  return score;
}

export {
  detectLaserHits,
  detectRoidHits,
  detectShipToShipCollisions,
  detectBotAsteroidCollisions,
};
