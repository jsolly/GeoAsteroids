import { GameController } from '../../core/gameController';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import type { Ship } from '../../entities/ship/Ship';

import { getGameBoundary } from '../../physics/boundary';
import { logger } from '../../utils/Logger';

// Circle boundary type local alias for clarity
type CircleBoundary = { cx: number; cy: number; radius: number };

// Helper function to project world coordinates to minimap coordinates
function projectToMiniMap(
  boundary: CircleBoundary,
  miniMapX: number,
  miniMapY: number,
  miniMapSize: number,
  worldX: number,
  worldY: number,
  tolerance = 10
): { x: number; y: number } | null {
  const normalizedX = (worldX - boundary.cx) / boundary.radius;
  const normalizedY = (worldY - boundary.cy) / boundary.radius;

  const x = miniMapX + miniMapSize / 2 + normalizedX * (miniMapSize / 2);
  const y = miniMapY + miniMapSize / 2 + normalizedY * (miniMapSize / 2);

  if (
    x < miniMapX - tolerance ||
    x > miniMapX + miniMapSize + tolerance ||
    y < miniMapY - tolerance ||
    y > miniMapY + miniMapSize + tolerance
  ) {
    return null;
  }
  return { x, y };
}

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
  ctx.clip(); // Clip before stroking to avoid antialias bleeding
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

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
  const LOCAL_PLAYER_COLOR = '#00ff00';
  const REMOTE_PLAYER_COLOR = '#00aaff';

  drawShipMiniMap(ctx, ship, LOCAL_PLAYER_COLOR, boundary, miniMapX, miniMapY, miniMapSize);

  // Draw all other players (bots + remote players) on mini map
  try {
    const gameController = GameController.getInstance();
    const playerNetwork = PlayerNetwork.getInstance();
    const otherPlayers = playerNetwork.getOtherPlayers(); // Gets all non-local players including bots

    for (const player of otherPlayers) {
      // Skip players who are exploding (truly dead)
      if (player.ship.exploding) {
        continue;
      }

      // Use different colors for different player types
      const color = player.type === 'bot' ? '#ff6600' : REMOTE_PLAYER_COLOR; // Orange for bots, blue for remote players

      drawShipMiniMap(ctx, player.ship, color, boundary, miniMapX, miniMapY, miniMapSize);
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
    logger.error(
      'RENDERING',
      'Error drawing mini map',
      error instanceof Error ? error : new Error(String(error))
    );
  }

  ctx.restore();
}

// Draw server name and connection status below the minimap
export function drawServerInfo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  try {
    // Server name is no longer available since we simplified the network manager
    const serverName = 'Game Server';

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
    logger.error(
      'RENDERING',
      'Error drawing server info',
      error instanceof Error ? error : new Error(String(error))
    );
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

  // Convert world coordinates to mini-map coordinates using shared helper
  const p = projectToMiniMap(
    boundary,
    miniMapX,
    miniMapY,
    miniMapSize,
    ship.position.x,
    ship.position.y,
    10
  );
  if (!p) {
    return;
  }

  // Draw ship dot on mini-map
  ctx.save();
  ctx.fillStyle = color;
  const dotSize = 3; // Small square size
  ctx.fillRect(p.x - dotSize / 2, p.y - dotSize / 2, dotSize, dotSize);
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
  // Convert world coordinates to mini-map coordinates using shared helper
  const p = projectToMiniMap(
    boundary,
    miniMapX,
    miniMapY,
    miniMapSize,
    roid.position.x,
    roid.position.y,
    10
  );
  if (!p) {
    return;
  }

  // Draw asteroid dot on mini-map (smaller than ships, space gray color)
  ctx.save();
  ctx.fillStyle = '#666666'; // Space gray color for asteroids
  const dotSize = 2; // Smaller than ship dots
  ctx.fillRect(p.x - dotSize / 2, p.y - dotSize / 2, dotSize, dotSize);
  ctx.restore();
}
