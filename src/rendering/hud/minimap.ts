import { PALETTE, VISUAL } from '../../constants';
import { GameController } from '../../core/gameController';
import type { Ship } from '../../entities/ship/Ship';
import { NetworkManager } from '../../network/networkManager';

import { getGameBoundary } from '../../physics/boundary';
import { getFactionColor, hexToRgba } from '../../utils/colorUtils';
import { logger } from '../../utils/Logger';

const miniMapPoint = { x: 0, y: 0 };

type CircleBoundary = { cx: number; cy: number; radius: number };

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
  miniMapPoint.x = x;
  miniMapPoint.y = y;
  return miniMapPoint;
}

export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ship: Ship
): void {
  const boundary = getGameBoundary();
  const miniMapSize = VISUAL.MINIMAP_SIZE;
  const centerX = canvas.width - 16 - miniMapSize / 2;
  const centerY = canvas.height - 16 - miniMapSize / 2;
  const miniMapX = centerX - miniMapSize / 2;
  const miniMapY = centerY - miniMapSize / 2;

  // Hairline radar ring only — no filled panel behind it; the void shows through.
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, miniMapSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.strokeStyle = hexToRgba(PALETTE.HUD_MUTED, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  const boundaryScale = miniMapSize / 2 / boundary.radius;
  const boundaryOffsetX = miniMapX + miniMapSize / 2;
  const boundaryOffsetY = miniMapY + miniMapSize / 2;

  ctx.strokeStyle = hexToRgba(PALETTE.ROID, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(boundaryOffsetX, boundaryOffsetY, boundary.radius * boundaryScale, 0, Math.PI * 2);
  ctx.stroke();

  drawShipMiniMap(ctx, ship, PALETTE.LOCAL, boundary, miniMapX, miniMapY, miniMapSize);

  try {
    const gameController = GameController.getInstance();
    const otherPlayers = NetworkManager.getInstance().getAllPlayers();

    for (const player of otherPlayers) {
      if (player.type === 'local' || player.ship.exploding) {
        continue;
      }
      const color = getFactionColor(player.type === 'bot' ? 'bot' : 'remote');
      drawShipMiniMap(ctx, player.ship, color, boundary, miniMapX, miniMapY, miniMapSize);
    }

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

export function drawServerInfo(_ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement): void {
  // Intentionally empty: playfield HUD no longer labels the radar.
}

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

  ctx.save();
  ctx.fillStyle = color;
  const dotSize = VISUAL.MINIMAP_DOT;
  ctx.beginPath();
  ctx.arc(p.x, p.y, dotSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRoidMiniMap(
  ctx: CanvasRenderingContext2D,
  roid: { position: { x: number; y: number }; r: number },
  boundary: CircleBoundary,
  miniMapX: number,
  miniMapY: number,
  miniMapSize: number
): void {
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

  ctx.save();
  ctx.fillStyle = hexToRgba(PALETTE.ROID, 0.7);
  ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
  ctx.restore();
}
