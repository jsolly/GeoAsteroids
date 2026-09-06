import { PALETTE, VISUAL } from '../../constants';
import { DEFAULT_SHIP_KIT_ID, type ShipKitId } from '../../entities/ship/shipKits';
import { strokeKitHullOutline } from '../../entities/ship/shipRenderer';

import { layoutHudCluster } from './cluster';

export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string,
  kitId: ShipKitId = DEFAULT_SHIP_KIT_ID
): void {
  const { lifeCenters } = layoutHudCluster(lives);
  const radius = VISUAL.HUD_LIFE_SIZE / 2;
  const color = shipColor || PALETTE.LOCAL;

  ctx.save();
  for (const center of lifeCenters) {
    strokeKitHullOutline(ctx, center.x, center.y, radius, Math.PI / 2, color, kitId);
  }
  ctx.restore();
}
