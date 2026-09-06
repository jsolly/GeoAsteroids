import { PALETTE, SHIP } from '../../constants';
import { DEFAULT_SHIP_KIT_ID, type ShipKitId } from '../../entities/ship/shipKits';
import { strokeKitHullOutline } from '../../entities/ship/shipRenderer';

export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string,
  kitId: ShipKitId = DEFAULT_SHIP_KIT_ID
): void {
  ctx.save();

  const spacing = SHIP.SIZE + 10;
  const startX = 20;
  const startY = 20;

  for (let i = 0; i < lives; i++) {
    const x = startX + i * spacing;
    const y = startY;
    const centerX = x + SHIP.SIZE / 2;
    const centerY = y + SHIP.SIZE / 2;
    const radius = SHIP.SIZE / 2;
    const angle = Math.PI / 2;

    strokeKitHullOutline(ctx, centerX, centerY, radius, angle, shipColor || PALETTE.LOCAL, kitId);
  }

  ctx.restore();
}
