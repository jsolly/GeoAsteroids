import type { Position } from '../../shared-types';
import { SHIP_EXPLODE_DUR_FRAMES } from '../constants/entities/ship';
import type { Player } from '../entities/player/Player';
import { Roid } from '../entities/roid/Roid';
import type { Ship } from '../entities/ship/Ship';
import { getGameBoundary } from '../physics/boundary';
import { isShipOutOfBounds } from '../physics/collision/boundaryCollisions';
import { logCollisionDetection } from '../physics/collision/collisionUtils';
import { canvasManager } from './canvas';

export function drawFieryBoundary(shipPosition: Position): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs) {
    return;
  }

  const boundary = getGameBoundary();

  // Convert world coordinates to screen coordinates
  // The boundary is in world coordinates, so we need to convert to screen coordinates
  const screenBoundary = {
    x: boundary.x - shipPosition.x + cvs.width / 2,
    y: boundary.y - shipPosition.y + cvs.height / 2,
    width: boundary.width,
    height: boundary.height,
  };

  // Create fiery effect with multiple layers
  const time = Date.now() * 0.005; // Animation speed

  // Draw outer fiery glow
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ff4400';
  ctx.lineWidth = 8;
  ctx.strokeRect(screenBoundary.x, screenBoundary.y, screenBoundary.width, screenBoundary.height);

  // Draw inner fiery border
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 4;
  ctx.strokeRect(screenBoundary.x, screenBoundary.y, screenBoundary.width, screenBoundary.height);

  // Draw animated fiery core
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsl(${15 + Math.sin(time) * 10}, 100%, 50%)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(screenBoundary.x, screenBoundary.y, screenBoundary.width, screenBoundary.height);

  // Draw corner flames for extra fiery effect
  const cornerSize = 20;
  const corners = [
    { x: screenBoundary.x, y: screenBoundary.y }, // Top-left
    { x: screenBoundary.x + screenBoundary.width, y: screenBoundary.y }, // Top-right
    { x: screenBoundary.x, y: screenBoundary.y + screenBoundary.height }, // Bottom-left
    { x: screenBoundary.x + screenBoundary.width, y: screenBoundary.y + screenBoundary.height }, // Bottom-right
  ];

  corners.forEach((corner, index) => {
    const flameIntensity = Math.sin(time + (index * Math.PI) / 2) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, ${100 + flameIntensity * 155}, 0, ${0.7 + flameIntensity * 0.3})`;

    // Draw flame effect
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, cornerSize * (0.5 + flameIntensity * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });

  // Reset shadow
  ctx.shadowBlur = 0;
}

// Boundary collision detection functions
export function detectBoundaryCollisions(ship: Ship): boolean {
  if (ship.exploding) {
    logCollisionDetection('Boundary Collision', 'Boundary', ship.id, false);
    return false;
  }

  // BOUNDARY IS THE ULTIMATE KILLER - ignores all invincibility!
  // No spawn protection, no blinking protection - if you hit the boundary, you die!
  if (isShipOutOfBounds(ship.position)) {
    logCollisionDetection('Boundary Collision', 'Boundary', ship.id, true);

    // Ship is out of bounds, trigger explosion
    ship.explode();

    // CRITICAL FIX: Dispatch shipExploded event so Player.onShipExploded() gets called
    // This is needed because boundary collisions bypass the normal damage system
    window.dispatchEvent(
      new CustomEvent('shipExploded', {
        detail: {
          shipId: ship.id,
          position: { x: ship.position.x, y: ship.position.y },
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
      // Player is out of bounds, trigger explosion directly (bypassing debug mode)
      player.ship.health = 0;
      player.ship.explode();
      player.ship.exploding = true;
      player.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

      window.dispatchEvent(
        new CustomEvent('shipExploded', {
          detail: {
            shipId: player.ship.id,
            position: { x: player.ship.position.x, y: player.ship.position.y },
          },
        })
      );

      // Play explosion sound
      Roid.fxHit.play();
    }
  }
}
