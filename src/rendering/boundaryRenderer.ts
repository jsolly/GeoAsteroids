import { SHIP_EXPLODE_DUR_FRAMES, SHIP_RESPAWN_DELAY_FRAMES } from '../constants/entities/ship';
import { getCTX, getCVS } from '../constants/rendering/canvas';
import { Asteroid } from '../entities/asteroid/Asteroid';
import type { Player, Position } from '../entities/player/types';
import type { Ship } from '../entities/ship/Ship';
import { getGameBoundary, isShipOutOfBounds } from '../physics/boundary';

export function drawFieryBoundary(shipPosition: Position): void {
  const ctx = getCTX();
  const cvs = getCVS();

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
    return false;
  }

  // Skip collision detection if ship is invincible (blinking or spawn protection)
  if (ship.blinkCount > 0) {
    return false;
  }

  if (isShipOutOfBounds(ship.position)) {
    // Ship is out of bounds, trigger explosion
    ship.explode();

    // Play explosion sound
    Asteroid.fxHit.play();

    return true;
  }

  return false;
}

export function detectPlayerBoundaryCollisions(otherPlayers: Player[]): void {
  if (!otherPlayers || otherPlayers.length === 0) {
    return;
  }

  for (const player of otherPlayers) {
    if (player.ship.exploding) {
      continue;
    }

    // Skip collision detection if player is invincible (blinking or spawn protection)
    if (player.ship.blinkCount > 0 || player.spawnProtectedUntil > Date.now()) {
      continue;
    }

    if (isShipOutOfBounds(player.ship.position)) {
      // Player is out of bounds, trigger explosion directly (bypassing debug mode)
      player.ship.health = 0;
      player.ship.explode();
      player.ship.exploding = true;
      player.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;

      // Start respawn timer and random position so it respawns after explosion
      player.respawnTimer = SHIP_RESPAWN_DELAY_FRAMES;

      // Generate random respawn position within the game boundary
      const boundary = getGameBoundary();
      const margin = 100; // Keep players away from the very edge
      const randomX = boundary.x + margin + Math.random() * (boundary.width - 2 * margin);
      const randomY = boundary.y + margin + Math.random() * (boundary.height - 2 * margin);
      player.respawnPosition = { x: randomX, y: randomY };

      // Play explosion sound
      Asteroid.fxHit.play();
    }
  }
}
