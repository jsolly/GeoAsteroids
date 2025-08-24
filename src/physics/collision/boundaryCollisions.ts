import type { Position } from '../../../shared-types';
import { SHIP_EXPLODE_DUR_FRAMES, SHIP_SIZE } from '../../constants/entities/ship';
import type { Player } from '../../entities/player/Player';
import { Roid } from '../../entities/roid/Roid';
import type { Ship } from '../../entities/ship/Ship';

import { getGameBoundary } from '../boundary';

export function isShipOutOfBounds(shipPosition: Position): boolean {
  const boundary = getGameBoundary();
  const shipRadius = SHIP_SIZE / 2;

  // Distance from center to ship center
  const dx = shipPosition.x - boundary.cx;
  const dy = shipPosition.y - boundary.cy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance + shipRadius > boundary.radius;
}

export function getBoundaryCollisionSide(
  _shipPosition: Position
): 'top' | 'right' | 'bottom' | 'left' | null {
  // For circular boundary we don't have sides; return null
  return null;
}

// Boundary collision detection functions
export function detectBoundaryCollisions(ship: Ship): boolean {
  if (ship.exploding) {
    return false;
  }

  // BOUNDARY IS THE ULTIMATE KILLER - ignores all invincibility!
  // No spawn protection, no blinking protection - if you hit the boundary, you die!
  if (isShipOutOfBounds(ship.position)) {
    // Store position where collision occurred for event
    const collisionPosition = { x: ship.position.x, y: ship.position.y };

    // Ship is out of bounds, trigger explosion (same as any other collision)
    ship.explode();

    // Set health to 0 to trigger respawn (same as other collision types)
    ship.health = 0;

    // Dispatch shipExploded event so Player.onShipExploded() gets called
    // This triggers the normal respawn process which will handle repositioning
    window.dispatchEvent(
      new CustomEvent('shipExploded', {
        detail: {
          shipId: ship.id,
          position: collisionPosition, // Use the position where collision occurred
        },
      })
    );

    // Play explosion sound
    Roid.fxHit.play();

    return true;
  }

  return false;
}

export function detectPlayerBoundaryCollisions(otherPlayers: Player[]): void {
  if (!otherPlayers || otherPlayers.length === 0) {
    return;
  }

  for (const player of otherPlayers) {
    // Skip if player is currently exploding or awaiting respawn
    if (player.ship.exploding || player.respawnTimer !== undefined) {
      continue;
    }

    if (isShipOutOfBounds(player.ship.position)) {
      // Store position where collision occurred for event
      const collisionPosition = { x: player.ship.position.x, y: player.ship.position.y };

      // Ship is out of bounds, trigger explosion (same as any other collision)
      player.ship.explode();
      player.ship.exploding = true;
      player.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

      // Set health to 0 to trigger respawn (same as other collision types)
      player.ship.health = 0;

      window.dispatchEvent(
        new CustomEvent('shipExploded', {
          detail: {
            shipId: player.ship.id,
            position: collisionPosition, // Use the position where collision occurred
          },
        })
      );

      // Play explosion sound
      Roid.fxHit.play();
    }
  }
}
