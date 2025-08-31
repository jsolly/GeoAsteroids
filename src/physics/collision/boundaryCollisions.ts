import type { Position } from '../../../shared-types';
import { playSound } from '../../audio/Sound';
import { SHIP } from '../../constants';
import type { Player } from '../../entities/player/Player';
import { Roid } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';
import { logger } from '../../utils/Logger';

import { getGameBoundary } from '../boundary';

export function isShipOutOfBounds(shipPosition: Position): boolean {
  const boundary = getGameBoundary();
  const shipRadius = SHIP.SIZE / 2;

  // Distance from center to ship center
  const dx = shipPosition.x - boundary.cx;
  const dy = shipPosition.y - boundary.cy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance + shipRadius > boundary.radius;
}

// Kept for API compatibility, circular boundary has no sides
export function getBoundaryCollisionSide(
  _shipPosition: Position
): 'top' | 'right' | 'bottom' | 'left' | null {
  return null;
}

// Boundary collision detection functions
export function detectBoundaryCollisions(shipOrPlayers: Ship | Player[]): boolean {
  // Handle array of players
  if (Array.isArray(shipOrPlayers)) {
    const players = shipOrPlayers;
    if (!players || players.length === 0) {
      return false;
    }

    let anyCollision = false;
    for (const player of players) {
      // Skip if player is currently exploding or awaiting respawn
      if (player.ship.exploding || player.respawnTimer !== undefined) {
        continue;
      }

      // Use the same boundary collision logic for each player
      if (detectBoundaryCollisions(player.ship)) {
        anyCollision = true;
      }
    }
    return anyCollision;
  }

  // Handle single ship
  const ship = shipOrPlayers;
  if (ship.exploding) {
    logger.debug('BOUNDARY', 'Ship already exploding, skipping boundary collision', {
      shipId: ship.id,
    });
    return false;
  }

  // BOUNDARY IS THE ULTIMATE KILLER - ignores all invincibility!
  // No spawn protection, no blinking protection - if you hit the boundary, you die!
  if (isShipOutOfBounds(ship.position)) {
    logger.debug('BOUNDARY', 'Ship out of bounds', {
      shipId: ship.id,
      position: { x: ship.position.x, y: ship.position.y },
    });

    // Store position where collision occurred for event
    const collisionPosition = { x: ship.position.x, y: ship.position.y };

    // Ship is out of bounds, trigger explosion (same as any other collision)
    logger.debug('BOUNDARY', 'Ship triggering explosion due to boundary collision', {
      shipId: ship.id,
    });
    ship.explode();

    // Set health to 0 to trigger respawn (same as other collision types)
    ship.health = 0;
    logger.debug('BOUNDARY', 'Ship health set to 0 due to boundary collision', { shipId: ship.id });

    // Dispatch shipExploded event so Player.onShipExploded() gets called
    // This triggers the normal respawn process which will handle repositioning
    logger.debug('BOUNDARY', 'Ship dispatching shipExploded event with cause: boundary', {
      shipId: ship.id,
    });
    window.dispatchEvent(
      new CustomEvent('shipExploded', {
        detail: {
          shipId: ship.id,
          cause: 'boundary',
          position: collisionPosition, // Use the position where collision occurred
        },
      })
    );

    // Play explosion sound
    playSound(Roid.fxHit);

    return true;
  }

  return false;
}

// Backwards compatibility wrapper used by callers/tests
export function detectPlayerBoundaryCollisions(localPlayer: Player, allPlayers?: Player[]): void {
  if (!allPlayers) {
    return;
  }

  // Filter out the local player to prevent self-collision
  const otherPlayers = allPlayers.filter((player) => player.id !== localPlayer.id);

  detectBoundaryCollisions(otherPlayers);
}
