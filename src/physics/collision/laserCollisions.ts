import { SHIP } from '../../constants';
import type { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { isBot, isRemote } from '../../entities/player/playerKinds';
import type { Roid, RoidBelt } from '../../entities/roid/Roid';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import { logger } from '../../utils/Logger';
import { getDistance } from '../../utils/mathUtils';
import { shouldApplyDamageToLocalPlayer, shouldSkipPlayerCollision } from './collisionUtils';

export function detectLaserPlayerCollisions(localPlayer: Player, allPlayers?: Player[]): number {
  const currShip = localPlayer.ship;

  if (!allPlayers) {
    return 0;
  }

  // Filter out the local player to prevent self-collision
  const otherPlayers = allPlayers.filter((player) => player.id !== localPlayer.id);

  if (!otherPlayers || otherPlayers.length === 0) {
    return 0;
  }

  const score = 0;

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

      // Skip invincible players (blinking or time-based spawn protection)
      if (shouldSkipPlayerCollision(player)) {
        continue;
      }

      // Check collision using distance and radius
      const distance = getDistance(laser.position, player.ship.position);
      const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        // Handle different player types appropriately
        if (isRemote(player)) {
          // For remote players, only notify server - don't apply damage locally
          const multiplayerManager = MultiplayerManager.getInstance();
          if (multiplayerManager.isConnected) {
            multiplayerManager.laserDamagePlayer(player.id, SHIP.COLLISION_DAMAGE);
          }
        } else {
          // For local players and bots, apply damage locally
          player.ship.takeDamage(SHIP.COLLISION_DAMAGE, 'laser', localPlayer.name);
        }

        // Activate laser explosion
        currShip.updateLaserExplodeTime(j);

        // Play hit sound
        laser.playHitSound();

        // Award points for player hit (similar to roid destruction)
        // Server handles all points in multiplayer mode
        logger.debug('COLLISION', 'Player hit - server will award points', {
          playerId: player.id,
          playerType: isRemote(player) ? 'remote' : 'local',
        });

        // Only handle one hit per laser per frame
        break;
      }
    }
  }

  return score;
}

export function detectPlayerLaserShipCollisions(
  localPlayer: Player,
  allPlayers?: Player[]
): number {
  const localShip = localPlayer.ship;

  if (!allPlayers) {
    return 0;
  }

  // Filter out the local player to prevent self-collision
  const otherPlayers = allPlayers.filter((player) => player.id !== localPlayer.id);

  if (!otherPlayers || otherPlayers.length === 0) {
    return 0;
  }

  // Scoring is handled server-authoritatively; this function only handles collision detection

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
        // Check if debug system wants to prevent damage to local player
        const shouldApplyDamage = shouldApplyDamageToLocalPlayer(localShip);

        // Apply unified laser damage
        if (shouldApplyDamage) {
          localShip.takeDamage(SHIP.COLLISION_DAMAGE, 'laser', player.name);
        }

        // Activate laser explosion using Ship's method
        player.ship.updateLaserExplodeTime(j);

        // Play hit sound
        laser.playHitSound();

        // Do not award local score here; attribution belongs to the shooter/server.

        // Only handle one hit per laser per frame
        break;
      }
    }
  }

  return 0;
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

export function isLaserHitPlayer(laser: Laser, player: Player): boolean {
  // Skip lasers that are already exploding or have exploded
  if (laser.explodeTime > 0 || laser.hasExploded) {
    return false;
  }

  // Calculate distance between laser and player center
  const distance = getDistance(player.ship.position, laser.position);

  // Make collision detection more forgiving - use a larger hit area
  // This accounts for the fact that lasers are moving and players are small
  const hitRadius = player.ship.r + 5; // Add 5 pixels of tolerance

  return distance < hitRadius;
}

export function detectLaserHits(
  currRoidBelt: RoidBelt,
  localPlayer: Player,
  allPlayers?: Player[]
): number {
  const currShip = localPlayer.ship;
  const roids = currRoidBelt.roids;
  const score = 0;
  const roidsToDestroy: number[] = [];
  const newRoidsToAdd: Roid[] = [];

  // Filter out the local player to prevent self-collision
  const otherPlayers = allPlayers
    ? allPlayers.filter((player) => player.id !== localPlayer.id)
    : [];

  // detect laser hits on roids
  for (let j = currShip.lasers.length - 1; j >= 0; j--) {
    const laser = currShip.lasers[j];

    // Skip lasers that are already exploding or have exploded
    if (laser.explodeTime > 0 || laser.hasExploded) {
      continue;
    }

    for (let i = roids.length - 1; i >= 0; i--) {
      // Skip if roid is already marked for destruction to prevent duplicate destruction
      if (roidsToDestroy.includes(i)) {
        continue;
      }

      // detect hits
      if (isHit(laser, roids[i])) {
        // remove roid and activate laser explosion
        laser.playHitSound();
        const destroyedRoid = roids[i];
        const result = currRoidBelt.destroyRoid(i);
        // Note: Score is now calculated server-side
        roidsToDestroy.push(i);
        newRoidsToAdd.push(...result.newRoids);
        currShip.updateLaserExplodeTime(j);

        // Notify server of asteroid destruction with points
        const multiplayerManager = MultiplayerManager.getInstance();
        multiplayerManager.asteroidDestroyed(destroyedRoid.id, result.score);

        break; // This laser is now exploded, move to next
      }
    }
  }

  // detect other player laser hits on roids (unified system)
  if (allPlayers && allPlayers.length > 0) {
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

        for (let i = roids.length - 1; i >= 0; i--) {
          // Skip if roid is already marked for destruction to prevent double-destruction
          if (roidsToDestroy.includes(i)) {
            continue;
          }

          if (isHit(laser, roids[i])) {
            laser.playHitSound();
            const destroyedRoid = roids[i];
            // Verify roid still exists at this index (in case it was destroyed by another laser)
            if (roids[i] && roids[i].id === destroyedRoid.id) {
              // Typically do not credit local score for remote hits.
              // If you must track global score locally, still accumulate:
              // score += currRoidBelt.destroyRoid(i);
              // If scores are per-player, do not mutate local score here and instead attribute to player.
              const result = currRoidBelt.destroyRoid(i);
              roidsToDestroy.push(i);
              newRoidsToAdd.push(...result.newRoids);
              // trigger laser explode like player
              player.ship.updateLaserExplodeTime(j);

              // Notify multiplayer manager of asteroid destruction
              const multiplayerManager = MultiplayerManager.getInstance();
              multiplayerManager.handleAsteroidDestruction(destroyedRoid.id);

              break; // This laser is now exploded, move to next
            }
          }
        }
      }
    }
  }

  // detect laser hits on other players (using the same filtered array)
  if (otherPlayers && otherPlayers.length > 0) {
    for (let j = currShip.lasers.length - 1; j >= 0; j--) {
      const laser = currShip.lasers[j];

      // Skip lasers that are already exploding or have exploded
      if (laser.explodeTime > 0 || laser.hasExploded) {
        continue;
      }

      for (const player of otherPlayers) {
        // Skip exploding players
        if (player.ship.exploding) {
          continue;
        }

        // Skip invincible players (blinking or time-based spawn protection)
        if (shouldSkipPlayerCollision(player)) {
          continue;
        }

        if (isLaserHitPlayer(laser, player)) {
          // Handle different player types
          if (isRemote(player)) {
            // For remote players, only notify server - don't apply damage locally
            const multiplayerManager = MultiplayerManager.getInstance();
            logger.debug('COLLISION', 'Sending laser damage to remote player', {
              playerId: player.id,
              damage: SHIP.COLLISION_DAMAGE,
              playerHealth: player.ship.health,
            });
            multiplayerManager.laserDamagePlayer(player.id, SHIP.COLLISION_DAMAGE);
          } else if (isBot(player)) {
            // For bots, apply damage locally and notify server
            player.ship.takeDamage(SHIP.COLLISION_DAMAGE, 'laser', localPlayer.name);

            // Notify server of bot damage for synchronization
            const multiplayerManager = MultiplayerManager.getInstance();
            multiplayerManager.laserDamageBot(player.id, SHIP.COLLISION_DAMAGE);
          } else {
            // For local player, apply damage locally
            player.ship.takeDamage(SHIP.COLLISION_DAMAGE, 'laser', localPlayer.name);
          }

          currShip.updateLaserExplodeTime(j);

          // Server handles all points in multiplayer mode
          logger.debug('COLLISION', 'Player/bot hit - server will award points', {
            playerId: player.id,
            playerType: isBot(player) ? 'bot' : 'player',
          });

          // Note: Kill message will be set when the player actually dies
          // This is handled in the playerDied event listener

          // Play hit sound
          laser.playHitSound();

          break; // This laser is now exploded, move to next
        }
      }
    }
  }

  // Remove destroyed roids and add new ones after iteration
  // Sort indices in descending order to avoid index shifting issues
  roidsToDestroy.sort((a, b) => b - a);
  for (const index of roidsToDestroy) {
    currRoidBelt.roids.splice(index, 1);
  }
  // Add new roids
  currRoidBelt.roids.push(...newRoidsToAdd);

  // NOTE: Intentional: bots should not damage other bots with lasers.
  // The following bot-on-bot laser collision handling has been removed to ensure
  // bots only attack players and roids.

  return score;
}
