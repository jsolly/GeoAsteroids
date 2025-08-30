import { LASER_EXPLODE_DUR } from '../../constants/entities/laser';
import { SHIP_COLLISION_DAMAGE } from '../../constants/entities/ship';
import { FPS } from '../../constants/game';
import type { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { isRemote } from '../../entities/player/playerKinds';
import type { Roid, RoidBelt } from '../../entities/roid/Roid';
import { getDistance } from '../../utils/mathUtils';
import { shouldApplyDamageToLocalPlayer, shouldSkipPlayerCollision } from './collisionUtils';

export function detectLaserHits(
  currRoidBelt: RoidBelt,
  localPlayer: Player,
  allPlayers?: Player[]
): number {
  const currShip = localPlayer.ship;
  const roids = currRoidBelt.roids;
  let score = 0;
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
      // detect hits
      if (isHit(laser, roids[i])) {
        // remove roid and activate laser explosion
        laser.playHitSound();
        const result = currRoidBelt.destroyRoid(i);
        score += result.score;
        roidsToDestroy.push(i);
        newRoidsToAdd.push(...result.newRoids);
        currShip.updateLaserExplodeTime(j);

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
          if (isHit(laser, roids[i])) {
            laser.playHitSound();
            // Typically do not credit local score for remote hits.
            // If you must track global score locally, still accumulate:
            // score += currRoidBelt.destroyRoid(i);
            // If scores are per-player, do not mutate local score here and instead attribute to player.
            const result = currRoidBelt.destroyRoid(i);
            roidsToDestroy.push(i);
            newRoidsToAdd.push(...result.newRoids);
            // trigger laser explode like player
            player.ship.updateLaserExplodeTime(j);

            break; // This laser is now exploded, move to next
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
          // Deal damage to player using the unified damage system
          player.ship.takeDamage(SHIP_COLLISION_DAMAGE);

          currShip.updateLaserExplodeTime(j);

          // Add points for destroying a player (only if player is actually destroyed)
          if (player.ship.exploding) {
            score += 200;
          }

          // Play hit sound
          laser.playHitSound();

          // Player destroyed - no event needed

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

      // Skip invincible players (blinking or time-based spawn protection)
      if (shouldSkipPlayerCollision(player)) {
        continue;
      }

      // Check collision using distance and radius
      const distance = getDistance(laser.position, player.ship.position);
      const collisionThreshold = player.ship.r + 2; // Laser radius is small, use 2 pixels

      if (distance < collisionThreshold) {
        // Apply damage to player using unified damage system
        player.ship.takeDamage(SHIP_COLLISION_DAMAGE);

        // Remote players are server-authoritative; do not dispatch client-side respawn logic.
        // Show explosion visuals client-side and let server send updated state/position.
        if (isRemote(player)) {
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
        }

        // Activate laser explosion
        currShip.updateLaserExplodeTime(j);

        // Play hit sound
        laser.playHitSound();

        // Award points for player hit (similar to roid destruction)
        score += 50;

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
          localShip.takeDamage(SHIP_COLLISION_DAMAGE);
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
