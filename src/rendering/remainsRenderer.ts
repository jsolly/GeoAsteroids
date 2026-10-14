import type { MapAsset, Position } from '../../shared-types';
import { getWorldRemains } from '../network/worldExploration';
import { canvasManager } from './canvasSurface';
import type { DrawingContext } from './drawingContext';

/** Broken ribs distinguish empty remains from recoverable cargo. */
export function drawRemainsMark(
  ctx: DrawingContext,
  x: number,
  y: number,
  radius: number,
  nest: boolean
): void {
  ctx.save();
  ctx.strokeStyle = '#8fa4ad';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (nest) {
    for (let side = -1; side <= 1; side += 2) {
      for (let leg = -1; leg <= 1; leg++) {
        ctx.moveTo(x, y + leg * radius * 0.35);
        ctx.lineTo(x + side * radius, y + leg * radius);
      }
    }
  } else {
    ctx.moveTo(x - radius, y + radius * 0.5);
    ctx.lineTo(x - radius * 0.25, y);
    ctx.moveTo(x + radius * 0.15, y - radius * 0.1);
    ctx.lineTo(x + radius, y - radius * 0.6);
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius * 0.5, y + radius * 0.8);
  }
  ctx.stroke();
  ctx.restore();
}

export function isRemains(asset: MapAsset): boolean {
  return asset.kind === 'ship-remains' || asset.kind === 'nest-remains';
}

export function drawWorldRemains(viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }
  const viewport = canvasManager.getViewportSize();
  const scale = canvasManager.getPlayfieldScale();
  for (const asset of getWorldRemains()) {
    if (!isRemains(asset)) {
      continue;
    }
    const at = canvasManager.worldToScreen(asset.position, viewer);
    if (at.x < -60 || at.y < -60 || at.x > viewport.width + 60 || at.y > viewport.height + 60) {
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawRemainsMark(
      ctx,
      at.x,
      at.y,
      (asset.kind === 'nest-remains' ? 25 : 16) * scale,
      asset.kind === 'nest-remains'
    );
    ctx.restore();
  }
}
