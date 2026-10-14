import { COOPERATIVE } from '../../shared/cooperativeRules';
import type { Position } from '../../shared-types';
import type { Player } from '../entities/player/Player';
import { canvasManager } from './canvasSurface';

/** Nearby signals remain visible at the playfield edge when their source is off-screen. */
export function drawCrewSignals(players: readonly Player[], viewer: Position): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }
  const viewport = canvasManager.getViewportSize();
  for (const pilot of players) {
    const downed = pilot.ship.downedUntil;
    const signal = pilot.ship.crewSignal;
    if (!downed && !signal) {
      continue;
    }
    const at = downed ? pilot.ship.position : signal?.position;
    if (!at || Math.hypot(at.x - viewer.x, at.y - viewer.y) > COOPERATIVE.signalRadius) {
      continue;
    }
    const screen = canvasManager.worldToScreen(at, viewer);
    const x = Math.max(40, Math.min(viewport.width - 40, screen.x));
    const y = Math.max(40, Math.min(viewport.height - 40, screen.y));
    ctx.save();
    ctx.strokeStyle = downed ? '#ffbd69' : '#78dddc';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ctx.stroke();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const label = downed ? `${pilot.name} · rescue` : `${pilot.name} · ${signal?.kind}`;
    const maxWidth = Math.max(1, viewport.width - 16);
    const halfWidth = Math.min(ctx.measureText(label).width, maxWidth) / 2;
    const labelX = Math.max(halfWidth + 8, Math.min(viewport.width - halfWidth - 8, x));
    ctx.fillText(label, labelX, y + 30, maxWidth);
    ctx.restore();
  }
}
