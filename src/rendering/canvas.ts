import type { Position } from '../../shared-types';
import { EMP, GAME, PALETTE } from '../constants';
import { drawFuelDropsRelative } from '../entities/fuel/fuelRenderer';
import type { FuelDrop } from '../entities/fuel/FuelDrop';
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
  drawEmpPulse,
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
import { drawFuelGauge } from './hud/fuel';
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

  // Initialize canvas with proper scaling
  initialize(): void {
    this.canvas = document.querySelector('canvas');
    this.context = this.canvas?.getContext('2d') || null;

    if (this.canvas && this.context) {
      // Get the viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Set the internal resolution to match the viewport (what the game logic uses)
      this.canvas.width = viewportWidth;
      this.canvas.height = viewportHeight;

      // Enable crisp pixel rendering
      this.context.imageSmoothingEnabled = true;
      this.context.imageSmoothingQuality = 'high';

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

      // Re-enable crisp rendering after resize
      this.context.imageSmoothingEnabled = true;
      this.context.imageSmoothingQuality = 'high';
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
  worldToScreen(worldPos: Position, shipPos: Position): Point {
    if (!this.canvas) {
      // Fallback to default values if canvas is not available
      return new Point(worldPos.x - shipPos.x, worldPos.y - shipPos.y);
    }

    return new Point(
      this.canvas.width / 2 - shipPos.x + worldPos.x,
      this.canvas.height / 2 - shipPos.y + worldPos.y
    );
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

    const screenPos = this.worldToScreen(worldPos, shipPos);
    return (
      screenPos.x >= -margin &&
      screenPos.x <= this.canvas.width + margin &&
      screenPos.y >= -margin &&
      screenPos.y <= this.canvas.height + margin
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
    allPlayers: Player[],
    fuelDrops: FuelDrop[] = []
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

    if (fuelDrops.length > 0) {
      drawFuelDropsRelative(currShip, fuelDrops);
    }

    if (currShip.empPulseActive) {
      const totalFrames = Math.ceil(EMP.DURATION * GAME.FPS);
      const empAlpha = totalFrames > 0 ? currShip.empPulseTime / totalFrames : 0;
      drawEmpPulse(currShip, EMP.RADIUS, empAlpha);
    }

    // Draw roids
    const roids = currRoidBelt.getRoids();
    if (roids.length > 0) {
      logger.debug('RENDERING', `Rendering ${roids.length} asteroids`);
      drawRoidsRelative(currShip, roids);
    } else {
      logger.debug('RENDERING', 'No asteroids to render');
    }

    // Draw all players (including bots) using unified rendering
    try {
      const localId = NetworkManager.getInstance().getLocalPlayerId();
      for (const player of allPlayers) {
        const factionColor = getFactionColor(player.type);
        if (player.ship.exploding) {
          if (player.id === localId) {
            drawShipExplosion(currShip, factionColor);
          } else {
            drawShipExplosionAtPosition(player.ship, currShip.position, factionColor);
          }
        } else if (player.ship.health <= 0) {
        } else if (player.id === localId) {
          drawShipAtPosition(currShip, currShip.position, factionColor, currPlayer.name);
        } else {
          drawShipAtPosition(player.ship, currShip.position, factionColor, player.name);
        }
      }
    } catch (error: unknown) {
      logger.error(
        'RENDERING',
        'Error drawing game',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Draw thrusters for all players (including bots) at their world positions
    try {
      const localId = NetworkManager.getInstance().getLocalPlayerId();
      for (const player of allPlayers) {
        if (player.ship.exploding || player.ship.health <= 0) {
          continue;
        }

        const factionColor = getFactionColor(player.type);
        if (player.id === localId) {
          if (!currShip.exploding && currShip.thrusting) {
            logger.debug('RENDERING', 'Drawing local player thruster', {
              thrusting: currShip.thrusting,
              blinkOn: currShip.blinkOn,
              exploding: currShip.exploding,
            });
            drawThruster(currShip, factionColor);
          } else {
            logger.debug('RENDERING', 'Local player thruster not drawn', {
              thrusting: currShip.thrusting,
              blinkOn: currShip.blinkOn,
              exploding: currShip.exploding,
            });
          }
        } else if (!player.ship.exploding && player.ship.thrusting) {
          drawThrusterAtPosition(player.ship, currShip.position, factionColor);
        }
      }
    } catch (error: unknown) {
      logger.error(
        'RENDERING',
        'Error drawing thrusters',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    drawLasers(currShip, getLaserColor(true));

    for (const player of allPlayers) {
      const localId = NetworkManager.getInstance().getLocalPlayerId();
      if (player.id === localId) {
        continue;
      }
      if (player.ship.exploding || player.ship.health <= 0) {
        continue;
      }

      drawLasers(player.ship, getLaserColor(false), currShip.position);
    }

    this.drawMiniMapWithPlayers(currShip);

    drawScoreOverlay(ctx, canvas, currScore);

    drawLivesIndicator(ctx, lives, PALETTE.LOCAL);
    drawFuelGauge(ctx, currShip.fuel, currShip.maxFuel);

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
