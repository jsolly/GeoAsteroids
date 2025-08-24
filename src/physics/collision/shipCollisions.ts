import type { Position } from '../../../shared-types';
import { LASER_EXPLODE_DUR } from '../../constants/entities/laser';
import { SHIP_COLLISION_DAMAGE, SHIP_EXPLODE_DUR_FRAMES } from '../../constants/entities/ship';
import { FPS } from '../../constants/game';
import type { Player } from '../../entities/player/Player';
import { Roid, type RoidBelt } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';
import { getDistance } from '../../utils/mathUtils';

import {
  dispatchBotDestroyedEvent,
  shouldApplyDamageToLocalPlayer,
  shouldSkipPlayerCollision,
} from './collisionUtils';

export function detectAllPlayerBotCollisions(
  localShip: Ship,
  otherPlayers: Player[],
  bots: Map<string, Player>
): void {
  if (!bots || bots.size === 0) {
    return;
  }

  // Create a combined list of all players including the local player
  const allPlayers: Array<{ id: string; position: Position; r: number; isLocal: boolean }> = [
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
      if (shouldSkipPlayerCollision(bot)) {
        continue;
      }

      // Calculate distance between player and bot centers
      const distance = getDistance(player.position, bot.ship.position);
      const collisionThreshold = player.r + bot.ship.r;

      if (distance < collisionThreshold) {
        if (player.isLocal) {
          // Local player collision with bot

          // Check if debug system wants to prevent damage
          const shouldApplyDamage = shouldApplyDamageToLocalPlayer(localShip);

          // Deal damage to local ship
          if (shouldApplyDamage) {
            localShip.takeDamage(SHIP_COLLISION_DAMAGE);
          }

          // Mark bot as exploding
          bot.ship.exploding = true;
          bot.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

          // Play hit sound
          Roid.fxHit.play();

          // Dispatch event to notify bot destruction
          dispatchBotDestroyedEvent(botId, 'local_player_collision');
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
                  // Note: Player removal is handled by the multiplayer manager
                  // This is just a placeholder for the explosion animation
                },
                Math.ceil(LASER_EXPLODE_DUR * 1000)
              ); // Remove after explosion duration
            }

            bot.ship.exploding = true;
            bot.ship.explodeTime = 60; // 1 second explosion duration

            // Play hit sound
            Roid.fxHit.play();

            // Dispatch event to notify bot destruction
            dispatchBotDestroyedEvent(botId, 'other_player_collision');
          }
        }

        // Only handle one collision per player per frame
        break;
      }
    }
  }
}

export function detectRoidHits(currShip: Ship, currRoidBelt: RoidBelt): number {
  let score = 0;

  // check for roid collisions (when not exploding)
  if (!currShip.exploding) {
    // only check when not blinking
    if (currShip.blinkCount === 0) {
      for (let i = 0; i < currRoidBelt.roids.length; i++) {
        if (
          getDistance(currShip.position, currRoidBelt.roids[i].position) <
          currShip.r + currRoidBelt.roids[i].r
        ) {
          // Check if debug system wants to prevent damage
          const shouldApplyDamage = shouldApplyDamageToLocalPlayer(currShip);

          // Deal damage instead of instant death
          if (shouldApplyDamage) {
            currShip.takeDamage(SHIP_COLLISION_DAMAGE);
          }

          // Never explode the ship here - let takeDamage handle life loss and respawn
          // The ship will only explode when it's actually dead (no lives remaining)

          Roid.fxHit.play();
          score = currRoidBelt.destroyRoid(i);
        }
      }
    }
  }
  return score;
}

export function detectShipToShipCollisions(
  currShip: Ship,
  otherPlayers: Player[],
  additionalPlayers?: Player[]
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

  // Combine all players for unified collision detection
  const allPlayers = additionalPlayers ? [...otherPlayers, ...additionalPlayers] : otherPlayers;

  // Check for ship-to-ship collisions with all other players
  for (const player of allPlayers) {
    // Skip exploding players
    if (player.ship.exploding) {
      continue;
    }

    // Check collision with ship
    const distance = getDistance(player.ship.position, currShip.position);
    const collisionThreshold = currShip.r + player.ship.r;

    if (distance < collisionThreshold) {
      // Skip invincible players (blinking or time-based spawn protection)
      if (shouldSkipPlayerCollision(player)) {
        continue;
      }

      // REGULAR MODE: Both ships are destroyed

      // Apply damage to the other player first so health bar shows the damage
      player.ship.takeDamage(SHIP_COLLISION_DAMAGE);

      // Now destroy the other player
      player.ship.exploding = true;
      player.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

      // Add points for destroying a player
      score += 200;

      // Check if debug system wants to prevent damage
      const shouldApplyDamage = shouldApplyDamageToLocalPlayer(currShip);

      // Check collision cooldown before applying damage to player ship
      if (shouldApplyDamage && currShip.canTakeCollisionDamage()) {
        // Destroy the current player ship
        currShip.takeDamage(SHIP_COLLISION_DAMAGE);
      }

      // Never explode the ship here - let takeDamage handle life loss and respawn
      // The ship will only explode when it's actually dead (no lives remaining)

      // Play hit sound
      Roid.fxHit.play();

      // Dispatch event to notify bot destruction
      dispatchBotDestroyedEvent('unknown', 'ship_collision');

      // Only handle one collision at a time to avoid multiple simultaneous destructions
      break;
    }
  }

  // Check for ship-to-ship collisions with other players
  if (otherPlayers && otherPlayers.length > 0) {
    for (const player of otherPlayers) {
      // Skip exploding players
      if (player.ship.exploding) {
        continue;
      }

      // Skip invincible players (blinking)
      if (player.ship.blinkCount && player.ship.blinkCount > 0) {
        continue;
      }

      // Calculate distance between ship centers
      const distance = getDistance(currShip.position, player.ship.position);
      const collisionThreshold = currShip.r + player.ship.r;

      if (distance < collisionThreshold) {
        // REGULAR MODE: Both ships are destroyed

        // Destroy the other player
        player.ship.exploding = true;
        player.ship.explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);

        // Add points for destroying another player
        score += 300;

        // Check if debug system wants to prevent damage
        const shouldApplyDamage = shouldApplyDamageToLocalPlayer(currShip);

        // Check collision cooldown before applying damage to current player ship
        if (shouldApplyDamage && currShip.canTakeCollisionDamage()) {
          // Destroy the current player ship
          currShip.takeDamage(SHIP_COLLISION_DAMAGE);
        }

        // Play hit sound
        Roid.fxHit.play();

        // Only handle one collision at a time
        break;
      }
    }
  }

  return score;
}

// Unified function for all player roid collisions (bots + remote players)
export function detectPlayerRoidCollisions(players: Player[], currRoidBelt: RoidBelt): void {
  if (!players || players.length === 0) {
    return;
  }

  const roids = currRoidBelt.roids;
  if (roids.length === 0) {
    return;
  }

  // Check each player for roid collisions
  for (const player of players) {
    // Skip exploding players
    if (player.ship.exploding) {
      continue;
    }

    // Skip invincible players (blinking or time-based spawn protection)
    if (shouldSkipPlayerCollision(player)) {
      continue;
    }

    // Check collision with each roid
    for (let i = 0; i < roids.length; i++) {
      const distance = getDistance(player.ship.position, roids[i].position);
      const collisionThreshold = player.ship.r + roids[i].r;

      if (distance < collisionThreshold) {
        // Deal damage to player instead of instant death
        // Use takeDamage to properly trigger explosion events and respawn logic
        player.ship.takeDamage(SHIP_COLLISION_DAMAGE);

        // If player health reaches 0, takeDamage will handle the explosion
        // and dispatch the shipExploded event, which will trigger respawn logic

        // Play hit sound
        Roid.fxHit.play();

        // Dispatch event to notify player destruction
        dispatchBotDestroyedEvent(player.id, 'roid_collision');

        // Only handle one collision per player to avoid multiple simultaneous destructions
        break;
      }
    }
  }
}
