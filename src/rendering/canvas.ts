import type { Position } from '../../shared-types';
import { PALETTE } from '../constants';
import {
  CANVAS_DEFAULT_CENTER_X,
  CANVAS_DEFAULT_CENTER_Y,
  CANVAS_INTERNAL_HEIGHT,
  CANVAS_INTERNAL_WIDTH,
} from '../constants/canvas';
import type { Player } from '../entities/player/Player';
import type { RoidBelt } from '../entities/roid/Roid';
import { drawRoidsRelative } from '../entities/roid/roidRenderer';
import type { Ship } from '../entities/ship/Ship';
import {
  drawLasers,
  drawShipAtPosition,
  drawShipExplosion,
  drawShipExplosionAtPosition,
  drawThruster,
  drawThrusterAtPosition,
} from '../entities/ship/shipRenderer';
import { NetworkManager } from '../network/networkManager';
import { Point } from '../physics/Point';
import { getFactionColor, getLaserColor } from '../utils/colorUtils';
import { isDebugMode } from '../utils/debugUtils';
import { logger } from '../utils/Logger';
import { drawFieryBoundary } from './boundaryRenderer';
import { drawDebugInfo, drawScoreOverlay, drawTextOverlay } from './hud/gameInfo';
import { drawLeaderboard } from './hud/leaderboard';
import { drawLivesIndicator } from './hud/lives';
import { drawMiniMap } from './hud/minimap';
import { drawStarfield } from './starfield';

// Canvas manager class for handling dynamic canvas operations and game rendering
class CanvasManager {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private resizeHandler: (() => void) | null = null;
  private readonly screenPos = { x: 0, y: 0 };

  // Initialize canvas with proper scaling
  initialize(): void {
    this.canvas = document.querySelector('canvas');
    // Opaque buffer: the playfield is a solid void, so the browser can skip
    // compositing the canvas against the page. Vector strokes stay hairline.
    this.context = this.canvas?.getContext('2d', { alpha: false }) || null;

    if (this.canvas && this.context) {
      // Get the viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Set the internal resolution to match the viewport (what the game logic uses)
      this.canvas.width = viewportWidth;
      this.canvas.height = viewportHeight;

      this.context.imageSmoothingEnabled = false;

      // Add resize handler to maintain full-screen coverage
      this.resizeHandler = this.handleCanvasResize.bind(this);
      window.addEventListener('resize', this.resizeHandler);

      // Initial resize call
      this.handleCanvasResize();
    }
  }

  // Handle canvas resizing to maintain full-screen coverage
  private handleCanvasResize(): void {
    if (this.canvas && this.context) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Update internal resolution to match new viewport size
      this.canvas.width = viewportWidth;
      this.canvas.height = viewportHeight;

      this.context.imageSmoothingEnabled = false;
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.canvas = null;
    this.context = null;
  }

  // Safe accessor methods for canvas and context
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.context;
  }

  requireCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return this.canvas;
  }

  requireContext(): CanvasRenderingContext2D {
    if (!this.context) {
      throw new Error('Canvas context not initialized');
    }
    return this.context;
  }

  // Coordinate scaling utilities for dynamic canvas sizes
  getScaleX(): number {
    return this.canvas ? this.canvas.width / CANVAS_INTERNAL_WIDTH : 1;
  }

  getScaleY(): number {
    return this.canvas ? this.canvas.height / CANVAS_INTERNAL_HEIGHT : 1;
  }

  scaleX(x: number): number {
    return x * this.getScaleX();
  }

  scaleY(y: number): number {
    return y * this.getScaleY();
  }

  getCanvasCenter(): { x: number; y: number } {
    return {
      x: this.canvas ? this.canvas.width / 2 : CANVAS_DEFAULT_CENTER_X,
      y: this.canvas ? this.canvas.height / 2 : CANVAS_DEFAULT_CENTER_Y,
    };
  }

  // Viewport transformation methods
  worldToScreenInto(
    out: { x: number; y: number },
    worldPos: Position,
    shipPos: Position
  ): { x: number; y: number } {
    if (!this.canvas) {
      out.x = worldPos.x - shipPos.x;
      out.y = worldPos.y - shipPos.y;
      return out;
    }

    out.x = this.canvas.width / 2 - shipPos.x + worldPos.x;
    out.y = this.canvas.height / 2 - shipPos.y + worldPos.y;
    return out;
  }

  worldToScreen(worldPos: Position, shipPos: Position): Point {
    const pos = this.worldToScreenInto(this.screenPos, worldPos, shipPos);
    return new Point(pos.x, pos.y);
  }

  screenToWorld(screenPos: Point, shipPos: Position): Position {
    if (!this.canvas) {
      // Fallback to default values if canvas is not available
      return { x: screenPos.x + shipPos.x, y: screenPos.y + shipPos.y };
    }

    return {
      x: screenPos.x - this.canvas.width / 2 + shipPos.x,
      y: screenPos.y - this.canvas.height / 2 + shipPos.y,
    };
  }

  isWorldPositionVisible(worldPos: Position, shipPos: Position, margin: number = 100): boolean {
    if (!this.canvas) {
      // Fallback to true if canvas is not available
      return true;
    }

    const x = this.canvas.width / 2 - shipPos.x + worldPos.x;
    const y = this.canvas.height / 2 - shipPos.y + worldPos.y;
    return (
      x >= -margin &&
      x <= this.canvas.width + margin &&
      y >= -margin &&
      y <= this.canvas.height + margin
    );
  }

  // Game rendering method that draws all game elements
  drawGame(
    currPlayer: Player,
    currRoidBelt: RoidBelt,
    currScore: number,
    textAlpha: number,
    text: string,
    lives: number,
    allPlayers: Player[]
  ): void {
    const currShip = currPlayer.ship;
    const ctx = this.getContext();
    const canvas = this.getCanvas();

    if (!ctx || !canvas) {
      return;
    }

    // Clear the canvas
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStarfield(currShip.position);

    // Draw fiery boundary using actual ship position for proper world coordinates
    drawFieryBoundary(currShip.position);

    const roids = currRoidBelt.getRoids();
    if (roids.length > 0) {
      drawRoidsRelative(currShip, roids);
    }

    const localId = NetworkManager.getInstance().getLocalPlayerId();
    const localLaserColor = getLaserColor(true);
    const enemyLaserColor = getLaserColor(false);

    try {
      for (const player of allPlayers) {
        const factionColor = getFactionColor(player.type);
        const isLocal = player.id === localId;
        const ship = isLocal ? currShip : player.ship;

        if (ship.exploding) {
          if (isLocal) {
            drawShipExplosion(currShip, factionColor);
          } else {
            drawShipExplosionAtPosition(ship, currShip.position, factionColor);
          }
        } else if (ship.health > 0) {
          drawShipAtPosition(
            ship,
            currShip.position,
            factionColor,
            isLocal ? currPlayer.name : player.name
          );
        }
      }

      for (const player of allPlayers) {
        const isLocal = player.id === localId;
        const ship = isLocal ? currShip : player.ship;
        if (ship.exploding || ship.health <= 0 || !ship.thrusting) {
          continue;
        }
        const factionColor = getFactionColor(player.type);
        if (isLocal) {
          drawThruster(currShip, factionColor);
        } else {
          drawThrusterAtPosition(ship, currShip.position, factionColor);
        }
      }
    } catch (error: unknown) {
      logger.error(
        'RENDERING',
        'Error drawing game',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    drawLasers(currShip, localLaserColor);

    for (const player of allPlayers) {
      if (player.id === localId || player.ship.exploding || player.ship.health <= 0) {
        continue;
      }
      drawLasers(player.ship, enemyLaserColor, currShip.position);
    }

    this.drawMiniMapWithPlayers(currShip);

    drawScoreOverlay(ctx, canvas, currScore);

    drawLivesIndicator(ctx, lives, PALETTE.LOCAL);

    if (text && textAlpha > 0) {
      drawTextOverlay(ctx, canvas, text, textAlpha);
    }

    if (allPlayers.length > 1) {
      drawLeaderboard(ctx, canvas, allPlayers, currPlayer.id);
    }

    const roidCount = currRoidBelt.roids.length;
    drawDebugInfo(ctx, canvas, roidCount, isDebugMode());
  }

  // Helper method to draw mini map with all players
  private drawMiniMapWithPlayers(ship: Ship): void {
    // Draw the base mini map
    const ctx = this.getContext();
    const canvas = this.getCanvas();
    if (ctx && canvas) {
      drawMiniMap(ctx, canvas, ship);
    }

    // The mini map module will handle drawing all players internally
  }
}

// Singleton instance
const canvasManager = new CanvasManager();

// Export the singleton instance
export { canvasManager };
