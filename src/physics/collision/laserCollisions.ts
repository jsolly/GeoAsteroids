import { LASER_EXPLODE_DUR } from '../../constants/entities/laser';
import { SHIP_COLLISION_DAMAGE } from '../../constants/entities/ship';
import { FPS } from '../../constants/game';
import type { Laser } from '../../entities/laser/Laser';
import type { Player } from '../../entities/player/Player';
import { Roid, type RoidBelt } from '../../entities/roid/Roid';

import { getDistance } from '../../utils/mathUtils';
import { shouldSkipPlayerCollision } from './collisionUtils';

export function detectLaserHits(
  currRoidBelt: RoidBelt,
  localPlayer: Player,
  allPlayers?: Player[]
): number {
  const currShip = localPlayer.ship;
  const roids = currRoidBelt.roids;
  let score = 0;

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
        Roid.fxHit.play();
        score = currRoidBelt.destroyRoid(i);
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
            Roid.fxHit.play();
            score = currRoidBelt.destroyRoid(i);
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
          Roid.fxHit.play();

          // Player destroyed - no event needed

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

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0 && player.ship.blinkOn) {
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
        if (player.type === 'remote') {
          player.ship.exploding = true;
          player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
        }

        // Activate laser explosion
        laser.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // Play hit sound
        Roid.fxHit.play();

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
        // Handle local ship damage using unified damage system
        const damage = 15; // Player laser damage
        // Apply damage via Ship.takeDamage so death triggers 'shipExploded' and respawn flow
        localShip.takeDamage(damage);

        // Activate laser explosion using Ship's method
        player.ship.updateLaserExplodeTime(j);

        // Play hit sound
        Roid.fxHit.play();

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
