import { PALETTE, SHIP } from '../../constants';
import { calculateShipTrianglePoints, strokePhosphorHull } from '../../entities/ship/shipRenderer';

// Helper function to draw player lives indicator
export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string
): void {
  ctx.save();

  // Draw ship icons for lives
  const spacing = SHIP.SIZE + 10; // Space between ships
  const startX = 20;
  const startY = 20;

  for (let i = 0; i < lives; i++) {
    const x = startX + i * spacing;
    const y = startY;

    // Use the exact same geometry calculation as the actual player ships
    const centerX = x + SHIP.SIZE / 2;
    const centerY = y + SHIP.SIZE / 2;
    const radius = SHIP.SIZE / 2;
    const angle = Math.PI / 2; // Face upward in lives display

    const { nose, rearLeft, rearRight } = calculateShipTrianglePoints(
      centerX,
      centerY,
      radius,
      angle
    );

    strokePhosphorHull(ctx, { nose, rearLeft, rearRight }, shipColor || PALETTE.LOCAL);
  }

  ctx.restore();
}
