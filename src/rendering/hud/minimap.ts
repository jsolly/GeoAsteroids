import { GameController } from '../../core/gameController';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import type { Ship } from '../../entities/ship/Ship';
import { getGameBoundary } from '../../physics/boundary';

// Circle boundary type local alias for clarity
type CircleBoundary = { cx: number; cy: number; radius: number };

// Helper function to draw the complete mini map
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ship: Ship
): void {
  // Get the game boundary for mini map calculations
  const boundary = getGameBoundary();

  // Mini map position and size (bottom right, circular)
  const miniMapSize = 160;
  const centerX = canvas.width - 20 - miniMapSize / 2;
  const centerY = canvas.height - 20 - miniMapSize / 2;
  const miniMapX = centerX - miniMapSize / 2;
  const miniMapY = centerY - miniMapSize / 2;

  // Draw circular minimap background with transparency and clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, miniMapSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();

  // Calculate scale to fit circle boundary in mini-map (circle to circle)
  const boundaryScale = miniMapSize / 2 / boundary.radius;
  const boundaryOffsetX = miniMapX + miniMapSize / 2;
  const boundaryOffsetY = miniMapY + miniMapSize / 2;

  // Draw boundary outline on mini map (circle)
  ctx.strokeStyle = 'rgba(255, 100, 0, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(boundaryOffsetX, boundaryOffsetY, boundary.radius * boundaryScale, 0, Math.PI * 2);
  ctx.stroke();

  // Draw current ship on mini map
  drawShipMiniMap(ctx, ship, '#00ff00', boundary, miniMapX, miniMapY, miniMapSize);

  // Draw all other players (bots + remote players) on mini map
  try {
    const gameController = GameController.getInstance();
    const playerNetwork = PlayerNetwork.getInstance();
    const allPlayers = playerNetwork.getAllPlayers();

    // Filter out local player to avoid drawing it twice (it's drawn above as current ship)
    const localPlayer = gameController.getCurrPlayer();
    const otherPlayers = allPlayers.filter((player) => player.id !== localPlayer.id);

    for (const player of otherPlayers) {
      drawShipMiniMap(ctx, player.ship, player.color, boundary, miniMapX, miniMapY, miniMapSize);
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
  boundary: CircleBoundary,
  miniMapX: number,
  miniMapY: number,
  miniMapSize: number
): void {
  if (ship.exploding) {
    return;
  }

  // Convert world coordinates to mini-map coordinates using circle-to-circle mapping
  const normalizedX = (ship.position.x - boundary.cx) / boundary.radius;
  const normalizedY = (ship.position.y - boundary.cy) / boundary.radius;

  const miniMapPosX = miniMapX + miniMapSize / 2 + normalizedX * (miniMapSize / 2);
  const miniMapPosY = miniMapY + miniMapSize / 2 + normalizedY * (miniMapSize / 2);

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
