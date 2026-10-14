import { COOPERATIVE, QUEEN_COMBAT } from '../../shared/cooperativeRules';
import { sacPosition } from '../../shared/frontier';
import type { Position } from '../../shared-types';
import { getWorldCampaign } from '../network/worldCampaign';
import { canvasManager } from './canvasSurface';

/** Snapshot-local encounter art uses the same world-space hit radii as the server. */
export function drawCampaign(viewer: Position, now: number): void {
  const ctx = canvasManager.getContext();
  const campaign = getWorldCampaign();
  if (!ctx || !campaign) {
    return;
  }
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 2;
  for (const hive of campaign.hives) {
    const at = canvasManager.worldToScreen(hive.position, viewer);
    if (hive.clearedAt === null) {
      ctx.strokeStyle = hive.shieldOpen ? '#ffad72' : '#af97ef';
      ctx.beginPath();
      ctx.arc(at.x, at.y, QUEEN_COMBAT.radius, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(at.x + Math.cos(a) * 40, at.y + Math.sin(a) * 40);
        ctx.lineTo(at.x + Math.cos(a + 0.2) * 82, at.y + Math.sin(a + 0.2) * 82);
      }
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(
        `Queen ${Math.ceil(hive.queenHealth)} / ${COOPERATIVE.queenHealth} · ${hive.shieldOpen ? 'exposed' : 'shielded'}`,
        at.x,
        at.y - 95
      );
    } else if (hive.commissionedAt === null) {
      ctx.strokeStyle = '#78dddc';
      ctx.strokeRect(at.x - 60, at.y - 60, 120, 120);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(
        `Restore · ${hive.restoredValue} / ${COOPERATIVE.restoreValue} supply`,
        at.x,
        at.y - 78
      );
    }
    hive.sacs.forEach((health, i) => {
      if (health <= 0) {
        return;
      }
      const sac = canvasManager.worldToScreen(
        sacPosition(hive.position, i, hive.sacs.length),
        viewer
      );
      ctx.strokeStyle = '#d4db8d';
      ctx.beginPath();
      ctx.ellipse(sac.x, sac.y, 34, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(`Sac ${Math.ceil(health)} / ${COOPERATIVE.sacHealth}`, sac.x, sac.y - 42);
    });
    if (hive.sacDeadline !== null) {
      ctx.fillStyle = '#d4db8d';
      ctx.fillText(
        `Sacs regrow in ${Math.max(0, Math.ceil((hive.sacDeadline - now) / 1000))}s`,
        at.x,
        at.y + 110
      );
    }
  }
  ctx.strokeStyle = '#ffad72';
  for (const meteor of campaign.meteors) {
    const at = canvasManager.worldToScreen(meteor.position, viewer);
    ctx.beginPath();
    ctx.arc(at.x, at.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
