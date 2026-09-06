import { PALETTE, VISUAL } from '../../constants';
import { calculateShipTrianglePoints, strokePhosphorHull } from '../../entities/ship/shipRenderer';

import { layoutHudCluster } from './cluster';

export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string
): void {
  const { lifeCenters } = layoutHudCluster(lives);
  const radius = VISUAL.HUD_LIFE_SIZE / 2;
  const color = shipColor || PALETTE.LOCAL;

  ctx.save();
  for (const center of lifeCenters) {
    const hull = calculateShipTrianglePoints(center.x, center.y, radius, Math.PI / 2);
    strokePhosphorHull(ctx, hull, color);
  }
  ctx.restore();
}
