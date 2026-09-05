import { PALETTE, SHIP, VISUAL } from '../../constants';
import { calculateShipTrianglePoints } from '../../entities/ship/shipRenderer';

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

    // Draw ship outline using the exact same style as actual ships
    ctx.strokeStyle = shipColor || PALETTE.LOCAL;
    ctx.lineWidth = VISUAL.SHIP_STROKE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y);
    ctx.lineTo(rearLeft.x, rearLeft.y);
    ctx.lineTo(rearRight.x, rearRight.y);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}
