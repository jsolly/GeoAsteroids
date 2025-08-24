import { GameController } from '../../core/gameController';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import type { Ship } from '../../entities/ship/Ship';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
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

  // Draw circular minimap background with solid black background and clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, miniMapSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)'; // Solid black background
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
      drawShipMiniMap(ctx, player.ship, '#ff0000', boundary, miniMapX, miniMapY, miniMapSize);
    }

    // Draw asteroids on mini map
    const currRoidBelt = gameController.getCurrRoidBelt();
    if (currRoidBelt) {
      const roids = currRoidBelt.getRoids();
      for (const roid of roids) {
        drawRoidMiniMap(ctx, roid, boundary, miniMapX, miniMapY, miniMapSize);
      }
    }
  } catch (error: unknown) {
    console.error('Error drawing mini map:', error);
  }

  ctx.restore();
}

// Draw server name and connection status below the minimap
export function drawServerInfo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  try {
    const multiplayerManager = MultiplayerManager.getInstance();
    const serverName = multiplayerManager.getServerName();

    // Position below the minimap
    const miniMapSize = 160;
    const centerX = canvas.width - 20 - miniMapSize / 2;
    const centerY = canvas.height - 20 - miniMapSize / 2;

    // Position server info directly below the minimap's bottom edge.
    // Render from the text's top so it never overlaps the minimap circle.
    const textHeight = 16; // Approximate height for server name only (14px font)
    const gapBelowMinimap = 10; // Small visual gap under minimap
    const minimapBottomEdge = centerY + miniMapSize / 2; // Bottom edge of minimap
    const serverInfoY = Math.min(
      minimapBottomEdge + gapBelowMinimap, // place text top just under the minimap
      canvas.height - textHeight // ensure text bottom stays within canvas
    );

    // Set text properties
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';

    // Draw server name only
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(serverName, centerX, serverInfoY);

    ctx.restore();
  } catch (error: unknown) {
    console.error('Error drawing server info:', error);
  }
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

// Draw an asteroid on the mini-map
export function drawRoidMiniMap(
  ctx: CanvasRenderingContext2D,
  roid: { position: { x: number; y: number }; r: number },
  boundary: CircleBoundary,
  miniMapX: number,
  miniMapY: number,
  miniMapSize: number
): void {
  // Convert world coordinates to mini-map coordinates using circle-to-circle mapping
  const normalizedX = (roid.position.x - boundary.cx) / boundary.radius;
  const normalizedY = (roid.position.y - boundary.cy) / boundary.radius;

  const miniMapPosX = miniMapX + miniMapSize / 2 + normalizedX * (miniMapSize / 2);
  const miniMapPosY = miniMapY + miniMapSize / 2 + normalizedY * (miniMapSize / 2);

  // Ensure the asteroid is within the mini-map bounds (with some tolerance for edge cases)
  const tolerance = 10; // Allow asteroids slightly outside the minimap
  if (
    miniMapPosX < miniMapX - tolerance ||
    miniMapPosX > miniMapX + miniMapSize + tolerance ||
    miniMapPosY < miniMapY - tolerance ||
    miniMapPosY > miniMapY + miniMapSize + tolerance
  ) {
    return; // Don't draw if too far outside mini-map
  }

  // Draw asteroid dot on mini-map (smaller than ships, space gray color)
  ctx.save();
  ctx.fillStyle = '#666666'; // Space gray color for asteroids
  const dotSize = 2; // Smaller than ship dots
  ctx.fillRect(miniMapPosX - dotSize / 2, miniMapPosY - dotSize / 2, dotSize, dotSize);
  ctx.restore();
}
