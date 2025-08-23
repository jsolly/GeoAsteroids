import { GameController } from '../../core/gameController';
import type { Ship } from '../../entities/ship/Ship';
import { getGameBoundary } from '../../physics/boundary';

// Interface for boundary objects
interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper function to draw the complete mini map
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ship: Ship
): void {
  // Get the game boundary for mini map calculations
  const boundary = getGameBoundary();

  // Mini map position and size (top right)
  const miniMapSize = 150;
  const miniMapX = canvas.width - miniMapSize - 20;
  const miniMapY = 20;

  // Draw mini map background
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
  ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);
  ctx.strokeStyle = '#00ff00'; // Bright green outline like the image
  ctx.lineWidth = 2; // Slightly thicker for better visibility
  ctx.strokeRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

  // Calculate scale to fit boundary in mini-map
  const boundaryScale = miniMapSize / Math.max(boundary.width, boundary.height);
  const boundaryOffsetX = miniMapX + miniMapSize / 2;
  const boundaryOffsetY = miniMapY + miniMapSize / 2;

  // Draw boundary outline on mini map
  ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    boundaryOffsetX - (boundary.width * boundaryScale) / 2,
    boundaryOffsetY - (boundary.height * boundaryScale) / 2,
    boundary.width * boundaryScale,
    boundary.height * boundaryScale
  );

  // Draw current ship on mini map
  drawShipMiniMap(ctx, ship, '#00ff00', boundary, miniMapX, miniMapY, miniMapSize);

  // Draw all other players (bots) on mini map
  try {
    const gameController = GameController.getInstance();
    const bots = gameController.getBots();

    for (const bot of bots.values()) {
      drawShipMiniMap(ctx, bot.ship, bot.color, boundary, miniMapX, miniMapY, miniMapSize);
    }
  } catch (error: unknown) {
    console.error('Error drawing mini map:', error);
  }

  ctx.restore();
}

// Draw a ship on the mini-map
export function drawShipMiniMap(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  color: string,
  boundary: Boundary,
  miniMapX: number,
  miniMapY: number,
  miniMapSize: number
): void {
  if (ship.exploding) {
    return;
  }

  // Convert world coordinates to mini-map coordinates
  // The boundary is centered at (0,0) in world space, so we need to map that correctly
  const worldX = ship.position.x - boundary.x; // Ship position relative to boundary corner
  const worldY = ship.position.y - boundary.y;

  // Center the position within the boundary, then scale to minimap
  const normalizedX = worldX / boundary.width - 0.5; // -0.5 to +0.5 range
  const normalizedY = worldY / boundary.height - 0.5;

  const miniMapPosX = miniMapX + miniMapSize / 2 + normalizedX * miniMapSize;
  const miniMapPosY = miniMapY + miniMapSize / 2 + normalizedY * miniMapSize;

  // Ensure the ship is within the mini-map bounds (with some tolerance for edge cases)
  const tolerance = 10; // Allow ships slightly outside the minimap
  if (
    miniMapPosX < miniMapX - tolerance ||
    miniMapPosX > miniMapX + miniMapSize + tolerance ||
    miniMapPosY < miniMapY - tolerance ||
    miniMapPosY > miniMapY + miniMapSize + tolerance
  ) {
    return; // Don't draw if too far outside mini-map
  }

  // Draw ship dot on mini-map
  ctx.save();
  ctx.fillStyle = color;
  // Draw small square instead of large circle
  const dotSize = 3; // Small square size
  ctx.fillRect(miniMapPosX - dotSize / 2, miniMapPosY - dotSize / 2, dotSize, dotSize);
  ctx.restore();
}
