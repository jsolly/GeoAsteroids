import { LASER_EXPLODE_DUR } from '../../constants/entities/laser';
import { SHIP_COLLISION_DAMAGE } from '../../constants/entities/ship';
import { FPS } from '../../constants/game';
import { GameController } from '../../core/gameController';
import type { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { Roid, type RoidBelt } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';
import { getDistance } from '../../utils/mathUtils';
import { dispatchBotDestroyedEvent, shouldSkipPlayerCollision } from './collisionUtils';

// Debug logging for laser collision issues
const DEBUG_LASER_COLLISIONS = import.meta.env?.DEV === true;

function logLaserCollision(
  laser: Laser,
  target: string,
  action: string,
  explodeTime: number
): void {
  if (DEBUG_LASER_COLLISIONS) {
    console.debug(
      `[LASER_COLLISION] Laser at (${laser.position.x.toFixed(1)}, ${laser.position.y.toFixed(1)}) ${action} ${target}, explodeTime: ${explodeTime}`
    );
  }
}

export function detectLaserHits(
  currRoidBelt: RoidBelt,
  currShip: Ship,
  bots?: Map<string, Player>
): number {
  const roids = currRoidBelt.roids;
  let score = 0;

  // detect laser hits on roids
  for (let j = currShip.lasers.length - 1; j >= 0; j--) {
    const laser = currShip.lasers[j];

    // Skip lasers that are already exploding or have exploded
    if (laser.explodeTime > 0 || laser.hasExploded) {
      continue;
    }

    for (let i = roids.length - 1; i >= 0; i--) {
      // detect hits
      if (isHit(laser, roids[i])) {
        logLaserCollision(laser, `roid ${i}`, 'hit', laser.explodeTime);

        // remove roid and activate laser explosion
        Roid.fxHit.play();
        score = currRoidBelt.destroyRoid(i);
        currShip.updateLaserExplodeTime(j);

        logLaserCollision(laser, `roid ${i}`, 'exploded', currShip.lasers[j].explodeTime);
        break; // This laser is now exploded, move to next
      }
    }
  }

  // detect bot laser hits on roids (unified system)
  if (bots && bots.size > 0) {
    for (const [, bot] of bots.entries()) {
      if (bot.ship.exploding) {
        continue;
      }

      for (let j = bot.ship.lasers.length - 1; j >= 0; j--) {
        const laser = bot.ship.lasers[j];

        // Skip lasers that are already exploding or have exploded
        if (laser.explodeTime > 0 || laser.hasExploded) {
          continue;
        }

        for (let i = roids.length - 1; i >= 0; i--) {
          if (isHit(laser, roids[i])) {
            logLaserCollision(laser, `roid ${i}`, 'hit (bot)', laser.explodeTime);

            Roid.fxHit.play();
            score = currRoidBelt.destroyRoid(i);
            // trigger laser explode like player
            bot.ship.updateLaserExplodeTime(j);

            logLaserCollision(laser, `roid ${i}`, 'exploded (bot)', bot.ship.lasers[j].explodeTime);
            break; // This laser is now exploded, move to next
          }
        }
      }
    }
  }

  // detect laser hits on bots (if bots are provided)
  if (bots && bots.size > 0) {
    for (let j = currShip.lasers.length - 1; j >= 0; j--) {
      const laser = currShip.lasers[j];

      // Skip lasers that are already exploding or have exploded
      if (laser.explodeTime > 0 || laser.hasExploded) {
        continue;
      }

      const botEntries = Array.from(bots.entries());
      for (const [botId, bot] of botEntries) {
        // Skip exploding bots
        if (bot.ship.exploding) {
          continue;
        }

        // Skip invincible bots (blinking or time-based spawn protection)
        if (shouldSkipPlayerCollision(bot)) {
          continue;
        }

        if (isLaserHitBot(laser, bot)) {
          logLaserCollision(laser, `bot ${botId}`, 'hit', laser.explodeTime);

          // Deal damage to bot using the unified damage system
          bot.ship.takeDamage(SHIP_COLLISION_DAMAGE);

          currShip.updateLaserExplodeTime(j);

          logLaserCollision(laser, `bot ${botId}`, 'exploded', currShip.lasers[j].explodeTime);

          // Add points for destroying a bot (only if bot is actually destroyed)
          if (bot.ship.exploding) {
            score += 200;
          }

          // Play hit sound
          Roid.fxHit.play();

          // Only dispatch event if bot is actually destroyed
          if (bot.ship.exploding) {
            dispatchBotDestroyedEvent(botId, 'laser_hit');
          }

          break; // This laser is now exploded, move to next
        }
      }
    }
  }

  // NOTE: Intentional: bots should not damage other bots with lasers.
  // The following bot-on-bot laser collision handling has been removed to ensure
  // bots only attack players and roids.

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

    // Skip lasers that are already exploding or have exploded
    if (laser.explodeTime > 0 || laser.hasExploded) {
      continue;
    }

    // Check each other player
    for (const player of otherPlayers) {
      // Skip exploding players
      if (player.ship.exploding) {
        continue;
      }

      // Skip bot players (they're handled by detectLaserHits)
      // Note: This function should only receive human players

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0 && player.ship.blinkOn) {
        continue;
      }

      // Check collision using distance and radius
      const distance = getDistance(laser.position, player.ship.position);
      const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        logLaserCollision(laser, `player ${player.id}`, 'hit', laser.explodeTime);

        // Handle player damage using health system (same as ship system)
        const damage = 15; // Laser damage
        const currentHealth = player.ship.health || 100;
        const newHealth = Math.max(0, currentHealth - damage);

        // Update player health
        player.ship.health = newHealth;
        player.ship.lastDamageTime = Date.now();

        // Activate laser explosion
        laser.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        logLaserCollision(laser, `player ${player.id}`, 'exploded', laser.explodeTime);

        // Play hit sound
        Roid.fxHit.play();

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

        // Award points for player hit (similar to roid destruction)
        score += 50;

        // Only handle one hit per laser per frame
        break;
      }
    }
  }

  return score;
}

export function detectPlayerLaserShipCollisions(localShip: Ship, otherPlayers: Player[]): number {
  if (!otherPlayers || otherPlayers.length === 0) {
    return 0;
  }

  let score = 0;

  // Check each player's lasers against the local ship
  for (const player of otherPlayers) {
    if (player.ship.exploding) {
      continue;
    }

    for (let j = player.ship.lasers.length - 1; j >= 0; j--) {
      const laser = player.ship.lasers[j];

      // Skip lasers that are already exploding or have exploded
      if (laser.explodeTime > 0 || laser.hasExploded) {
        continue;
      }

      // Check collision using distance and radius
      const distance = getDistance(laser.position, localShip.position);
      const collisionThreshold = localShip.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        logLaserCollision(laser, `local ship`, 'hit', laser.explodeTime);

        // Handle local ship damage using health system
        const damage = 15; // Player laser damage
        const currentHealth = localShip.health || 100;
        const newHealth = Math.max(0, currentHealth - damage);

        // Update ship health
        localShip.health = newHealth;
        localShip.lastDamageTime = Date.now();

        // Activate laser explosion using Ship's method
        player.ship.updateLaserExplodeTime(j);

        logLaserCollision(laser, `local ship`, 'exploded', player.ship.lasers[j].explodeTime);

        // Play hit sound
        Roid.fxHit.play();

        // Check if ship should die from health loss
        if (newHealth <= 0) {
          // Ship will be handled by Player's event system
          localShip.explode();
        }

        // Award score for player hitting local ship
        score += 50;

        // Only handle one hit per laser per frame
        break;
      }
    }
  }

  return score;
}

export function isHit(laser: Laser, roid: Roid): boolean {
  if (
    laser.explodeTime === 0 &&
    !laser.hasExploded &&
    getDistance(roid.position, laser.position) < roid.r
  ) {
    return true;
  }
  return false;
}

export function isLaserHitBot(laser: Laser, bot: Player): boolean {
  // Skip lasers that are already exploding or have exploded
  if (laser.explodeTime > 0 || laser.hasExploded) {
    return false;
  }

  // Calculate distance between laser and bot center
  const distance = getDistance(bot.ship.position, laser.position);

  // Make collision detection more forgiving - use a larger hit area
  // This accounts for the fact that lasers are moving and bots are small
  const hitRadius = bot.ship.r + 5; // Add 5 pixels of tolerance

  return distance < hitRadius;
}
