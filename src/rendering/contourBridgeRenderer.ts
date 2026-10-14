import type { Position } from '../../shared-types';
import { getContourBridges } from '../physics/terrain/contourBridgeSession';
import { canvasManager } from './canvasSurface';

export function drawContourBridges(viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }
  const scale = canvasManager.getPlayfieldScale();
  for (const bridge of getContourBridges()) {
    const from = canvasManager.worldToScreen(bridge.from, viewer);
    const to = canvasManager.worldToScreen(bridge.to, viewer);
    ctx.save();
    ctx.strokeStyle = bridge.charged ? '#a4eeff' : '#738389';
    ctx.globalAlpha = Math.min(1, bridge.framesLeft / 60) * (bridge.charged ? 0.9 : 0.45);
    ctx.lineWidth = (bridge.charged ? 3 : 1) * scale;
    ctx.setLineDash(bridge.charged ? [] : [3, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2, Math.min(from.y, to.y) - 12 * scale, to.x, to.y);
    ctx.stroke();
    if (bridge.charged) {
      ctx.beginPath();
      ctx.arc(from.x, from.y, 8 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '10px monospace';
      ctx.fillStyle = '#a4eeff';
      ctx.fillText('3 · DRAFT', from.x + 10 * scale, from.y - 8 * scale);
    }
    ctx.restore();
  }
}
