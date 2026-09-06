import { PALETTE, VISUAL } from '../../constants';
import { GameController } from '../../core/gameController';
import { drawSoftFactionMark } from '../../entities/player/factionMarkPainters';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import type { SoftFactionId } from '../../entities/player/softFactions';
import { canDrawAsteroid } from '../../entities/roid/roidRenderer';
import type { Ship } from '../../entities/ship/Ship';
import { calculateShipTrianglePoints, strokePhosphorHull } from '../../entities/ship/shipRenderer';
import type { CircleBoundary } from '../../physics/boundary';
import { getGameBoundary } from '../../physics/boundary';
import { isAsteroidPending } from '../../physics/collision/asteroidHitFeel';
import { getShipDisplayColor, hexToRgba } from '../../utils/colorUtils';
import { logger } from '../../utils/Logger';

type RadarMark =
  | { kind: 'local'; x: number; y: number; heading: number; factionId?: SoftFactionId }
  | { kind: 'other'; x: number; y: number; heading: number; color: string; factionId?: SoftFactionId }
  | { kind: 'roid'; x: number; y: number };

export function projectWorldToMiniMap(
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

function drawRadarMark(ctx: CanvasRenderingContext2D, mark: RadarMark): void {
  switch (mark.kind) {
    case 'local': {
      const hull = calculateShipTrianglePoints(
        mark.x,
        mark.y,
        VISUAL.MINIMAP_LOCAL_SIZE,
        mark.heading
      );
      strokePhosphorHull(ctx, hull, PALETTE.LOCAL);
      drawSoftFactionMark(ctx, mark.factionId, {
        x: mark.x,
        y: mark.y,
        radius: VISUAL.MINIMAP_LOCAL_SIZE,
        angle: mark.heading,
      });
      return;
    }
    case 'other': {
      ctx.save();
      ctx.fillStyle = mark.color;
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, VISUAL.MINIMAP_DOT / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawSoftFactionMark(ctx, mark.factionId, {
        x: mark.x,
        y: mark.y,
        radius: VISUAL.MINIMAP_DOT,
        angle: mark.heading,
      });
      return;
    }
    case 'roid': {
      ctx.save();
      ctx.fillStyle = hexToRgba(PALETTE.ROID, 0.55);
      const size = VISUAL.MINIMAP_ROID;
      ctx.fillRect(mark.x - size / 2, mark.y - size / 2, size, size);
      ctx.restore();
      return;
    }
  }
}

export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ship: Ship
): void {
  const boundary = getGameBoundary();
  const miniMapSize = VISUAL.MINIMAP_SIZE;
  const centerX = canvas.width - VISUAL.HUD_INSET - miniMapSize / 2;
  const centerY = canvas.height - VISUAL.HUD_INSET - miniMapSize / 2;
  const miniMapX = centerX - miniMapSize / 2;
  const miniMapY = centerY - miniMapSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, miniMapSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(PALETTE.BG, VISUAL.MINIMAP_VOID_ALPHA);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(PALETTE.HUD_MUTED, VISUAL.MINIMAP_RING_ALPHA);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  try {
    const gameController = GameController.getInstance();
    const playerNetwork = PlayerNetwork.getInstance();
    const otherPlayers = playerNetwork.getOtherPlayers();

    const currRoidBelt = gameController.getCurrRoidBelt();
    if (currRoidBelt) {
      for (const roid of currRoidBelt.getRoids()) {
        if (isAsteroidPending(roid) || !canDrawAsteroid(roid)) {
          continue;
        }
        const p = projectWorldToMiniMap(
          boundary,
          miniMapX,
          miniMapY,
          miniMapSize,
          roid.position.x,
          roid.position.y
        );
        if (p) {
          drawRadarMark(ctx, { kind: 'roid', x: p.x, y: p.y });
        }
      }
    }

    for (const player of otherPlayers) {
      if (player.ship.exploding) {
        continue;
      }
      const p = projectWorldToMiniMap(
        boundary,
        miniMapX,
        miniMapY,
        miniMapSize,
        player.ship.position.x,
        player.ship.position.y
      );
      if (!p) {
        continue;
      }
      drawRadarMark(ctx, {
        kind: 'other',
        x: p.x,
        y: p.y,
        heading: player.ship.angle,
        color: getShipDisplayColor(player),
        factionId: player.ship.factionId,
      });
    }

    if (!ship.exploding) {
      const p = projectWorldToMiniMap(
        boundary,
        miniMapX,
        miniMapY,
        miniMapSize,
        ship.position.x,
        ship.position.y
      );
      if (p) {
        drawRadarMark(ctx, {
          kind: 'local',
          x: p.x,
          y: p.y,
          heading: ship.angle,
          factionId: ship.factionId,
        });
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

export function drawServerInfo(_ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement): void {}
