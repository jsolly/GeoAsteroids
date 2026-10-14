import { getTerrainField } from '../../shared/terrainField';
import { nearbyRouteWaypoints } from '../../shared/travelRoutes';
import type { Position } from '../../shared-types';
import { canvasManager } from './canvasSurface';

/** Sparse paired arches accent the same deterministic passages that shape the contours. */
export function drawRouteWaypoints(viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }
  const scale = canvasManager.getPlayfieldScale();
  const viewport = canvasManager.getViewportSize();
  for (const waypoint of nearbyRouteWaypoints(getTerrainField(), viewer)) {
    const at = canvasManager.worldToScreen(waypoint.position, viewer);
    if (at.x < -50 || at.y < -50 || at.x > viewport.width + 50 || at.y > viewport.height + 50) {
      continue;
    }
    ctx.save();
    ctx.strokeStyle = '#718c96';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      ctx.moveTo(at.x + sign * 30 * scale, at.y - 18 * scale);
      ctx.lineTo(at.x + sign * 40 * scale, at.y);
      ctx.lineTo(at.x + sign * 30 * scale, at.y + 18 * scale);
    }
    ctx.stroke();
    ctx.restore();
  }
}
