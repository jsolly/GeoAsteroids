import { playSound } from '../../audio/Sound';
import { SHIP } from '../../constants';
import type { Player } from '../../entities/player/Player';
import { Roid, type RoidBelt } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import { logger } from '../../utils/Logger';
import { getDistance } from '../../utils/mathUtils';

import { shouldApplyDamageToLocalPlayer, shouldSkipPlayerCollision } from './collisionUtils';

export function detectAllPlayerCollisions(localPlayer: Player, allPlayers?: Player[]): void {
  const localShip = localPlayer.ship;

  if (!allPlayers) {
    return;
  }

  // Filter out the local player to prevent self-collision
  const otherPlayers = allPlayers.filter((player) => player.id !== localPlayer.id);

  if (!otherPlayers || otherPlayers.length === 0) {
    return;
  }

  // Check local ship against all other players
  if (localShip.exploding || localShip.blinkCount > 0) {
    return; // Skip if local ship is exploding or invincible
  }

  // Track current collisions and manage damage-over-time
  const currentlyCollidingPlayers = new Set<string>();

  for (const otherPlayer of otherPlayers) {
    // Skip exploding other players
    if (otherPlayer.ship.exploding) {
      continue;
    }

    // Skip invincible other players (blinking or time-based spawn protection)
    if (shouldSkipPlayerCollision(otherPlayer)) {
      continue;
    }

    // Calculate distance between local ship and other player centers
    const distance = getDistance(localShip.position, otherPlayer.ship.position);
    const collisionThreshold = localShip.r + otherPlayer.ship.r;

    if (distance < collisionThreshold) {
      // We are currently colliding with this player
      currentlyCollidingPlayers.add(otherPlayer.id);

      // Start collision damage if not already active
      if (!localShip.isCollidingWithPlayer || localShip.collidingPlayerId !== otherPlayer.id) {
        logger.debug('COLLISION', 'Starting collision damage', {
          localPlayer: localPlayer.id,
          remotePlayer: otherPlayer.id,
          remotePlayerType: otherPlayer.type,
          remotePlayerIsBot: otherPlayer.id.startsWith('server-bot-'),
        });
        localShip.startPlayerCollision(otherPlayer.id);
        // For remote players, we don't start collision on their ship locally
        // since they handle their own collision detection on their client
      }

      // Play hit sound (only once when collision starts with this player)
      if (!localShip.isCollidingWithPlayer || localShip.collidingPlayerId !== otherPlayer.id) {
        playSound(Roid.fxHit);
      }
    }
  }

  // Stop collision damage if we're no longer colliding with the tracked player
  if (currentlyCollidingPlayers.size === 0 && localShip.isCollidingWithPlayer) {
    logger.debug('COLLISION', 'Stopping collision damage - no longer colliding', {
      localPlayer: localPlayer.id,
      previouslyCollidingWith: localShip.collidingPlayerId,
    });
    localShip.stopPlayerCollision();
  } else if (currentlyCollidingPlayers.size > 0 && localShip.collidingPlayerId) {
    // Check if we're still colliding with the currently tracked player
    if (!currentlyCollidingPlayers.has(localShip.collidingPlayerId)) {
      logger.debug('COLLISION', 'Stopping collision damage - switched collision target', {
        localPlayer: localPlayer.id,
        previouslyCollidingWith: localShip.collidingPlayerId,
        nowCollidingWith: Array.from(currentlyCollidingPlayers)[0],
      });
      localShip.stopPlayerCollision();
    }
  }
}

export function detectRoidHits(currShip: Ship, currRoidBelt: RoidBelt): number {
  let score = 0;
  const roidsToDestroy: number[] = [];
  const newRoidsToAdd: Roid[] = [];

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

          if (shouldApplyDamage) {
            // Deal damage via server when connected; otherwise apply locally
            const multiplayerManager = MultiplayerManager.getInstance();
            if (multiplayerManager.isConnected) {
              const myPlayerId = multiplayerManager.getLocalPlayerId();
              if (myPlayerId) {
                // Use collisionDamage with attacker=self to avoid point awards
                multiplayerManager.collisionDamagePlayer(
                  myPlayerId,
                  myPlayerId,
                  SHIP.COLLISION_DAMAGE
                );
              } else {
                currShip.takeDamage(SHIP.COLLISION_DAMAGE, 'asteroid');
              }
            } else {
              currShip.takeDamage(SHIP.COLLISION_DAMAGE, 'asteroid');
            }
            playSound(Roid.fxHit);
            const result = currRoidBelt.destroyRoid(i);
            score += result.score;
            roidsToDestroy.push(i);
            newRoidsToAdd.push(...result.newRoids);
          }
          // If shouldApplyDamage is false, skip the entire collision processing
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

  return score;
}

export function detectShipToShipCollisions(
  currShip: Ship,
  otherPlayers: Player[],
  localPlayer: Player,
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

      // Ship-to-ship collision: both ships take damage
      player.ship.takeDamage(SHIP.COLLISION_DAMAGE, 'player', localPlayer.name);

      // Check if the other ship exploded, and if so, stop processing
      if (player.ship.exploding) {
        // Award points for destroying another player
        score += 300;
        // Play hit sound
        playSound(Roid.fxHit);
        break;
      }

      currShip.takeDamage(SHIP.COLLISION_DAMAGE, 'player', player.name);

      // Check if current ship exploded, and if so, stop processing
      if (currShip.exploding) {
        // Award points for destroying another player
        score += 300;
        // Play hit sound
        playSound(Roid.fxHit);
        break;
      }

      // Award points for destroying another player
      score += 300;

      // Play hit sound
      playSound(Roid.fxHit);

      // Bot destroyed - no event needed

      // Only handle one collision at a time to avoid multiple simultaneous destructions
      break;
    }
  }

  // Note: Collision detection with all players (including otherPlayers) is already handled above

  return score;
}

// Unified function for all player roid collisions (bots + remote players)
export function detectPlayerRoidCollisions(
  localPlayer: Player,
  allPlayers?: Player[],
  currRoidBelt?: RoidBelt
): void {
  if (!allPlayers || !currRoidBelt) {
    return;
  }

  // Filter out the local player to prevent self-collision
  const players = allPlayers.filter((player) => player.id !== localPlayer.id);

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
        player.ship.takeDamage(SHIP.COLLISION_DAMAGE, 'asteroid');

        // If player health reaches 0, takeDamage will handle the explosion
        // and dispatch the shipExploded event, which will trigger respawn logic

        // Play hit sound
        playSound(Roid.fxHit);

        // Player destroyed - no event needed

        // Only handle one collision per player to avoid multiple simultaneous destructions
        break;
      }
    }
  }
}
