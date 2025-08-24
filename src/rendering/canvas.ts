import type { Position } from '../../shared-types';
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
import { drawLasers, drawShipAtPosition } from '../entities/ship/shipRenderer';
import { Point } from '../physics/Point';
import { drawFieryBoundary } from './boundaryRenderer';
import {
  drawLeaderboard,
  drawLeftHudPanel,
  drawScoreOverlay,
  drawTextOverlay,
} from './hud/gameInfo';
import { drawMiniMap } from './hud/minimap';

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
      this.context.imageSmoothingEnabled = false;
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
      this.context.imageSmoothingEnabled = false;
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
    currShip: Ship,
    currRoidBelt: RoidBelt,
    currScore: number,
    textAlpha: number,
    text: string,
    lives: number,
    allPlayers: Player[],
    currentPlayerId: string,
    isConnected: boolean,
    fps: number
  ): void {
    const ctx = this.getContext();
    const canvas = this.getCanvas();

    if (!ctx || !canvas) {
      return;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw fiery boundary
    drawFieryBoundary(currShip.position);

    // Draw roids
    const roids = currRoidBelt.getRoids();
    if (roids.length > 0) {
      drawRoidsRelative(currShip, roids);
    }

    // Draw all players (including bots) using unified rendering
    try {
      for (const player of allPlayers) {
        if (!player.ship.exploding) {
          // All players use the same ship rendering with world coordinates
          drawShipAtPosition(player.ship, currShip.position);
        }
      }
    } catch (error: unknown) {
      console.error('Error drawing game:', error);
    }

    // Draw ship (if not exploding, this will be handled by handleShipState)
    // The ship drawing is handled separately in the event loop for blinking effects

    // Draw ship lasers
    drawLasers(currShip);

    // Draw mini map with all players, bots, and lasers
    this.drawMiniMapWithPlayers(currShip);

    // Draw score overlay
    drawScoreOverlay(ctx, canvas, currScore);

    // Left HUD panel (lives, fps, connection)
    const remoteHumanCount = allPlayers.filter((p) => p.type === 'remote').length;
    const botCount = allPlayers.filter((p) => p.type === 'bot').length;
    drawLeftHudPanel(
      ctx,
      canvas,
      lives,
      currShip.color,
      fps,
      isConnected,
      allPlayers.length,
      remoteHumanCount,
      botCount
    );

    // Draw text overlay if there is text to display
    if (text && textAlpha > 0) {
      drawTextOverlay(ctx, canvas, text, textAlpha);
    }

    // Draw leaderboard if there are multiple players
    if (allPlayers.length > 1) {
      drawLeaderboard(ctx, canvas, allPlayers, currentPlayerId);
    }
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
