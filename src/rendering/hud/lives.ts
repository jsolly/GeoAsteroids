import { PALETTE, VISUAL } from '../../constants';
import { calculateShipTrianglePoints } from '../../entities/ship/shipRenderer';

export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string
): void {
  ctx.save();

  const size = VISUAL.LIVES_ICON_SIZE;
  const spacing = size + 8;
  const startX = VISUAL.HUD_PAD;
  const startY = VISUAL.HUD_PAD;

  for (let i = 0; i < lives; i++) {
    const centerX = startX + i * spacing + size / 2;
    const centerY = startY + size / 2;
    const radius = size / 2;
    const angle = Math.PI / 2;

    const { nose, rearLeft, rearRight } = calculateShipTrianglePoints(
      centerX,
      centerY,
      radius,
      angle
    );

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
