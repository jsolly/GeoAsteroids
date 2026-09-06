import type { FactionId } from '../../../shared-types';
import { PALETTE } from '../../constants';
import type { Player } from '../../entities/player/Player';
import { getShipDisplayColor, hexToRgba } from '../../utils/colorUtils';

interface LeaderboardEntry {
  name: string;
  score: number;
  type: 'local' | 'remote' | 'bot';
  faction?: FactionId;
  color?: string;
  isCurrentPlayer?: boolean;
}

export function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  players: Player[],
  currentPlayerId: string
): void {
  if (players.length === 0) {
    return;
  }

  const entries: LeaderboardEntry[] = players
    .map((player) => ({
      name: player.name,
      score: player.score,
      type: player.type,
      faction: player.faction,
      color: player.color,
      isCurrentPlayer: player.id === currentPlayerId,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const boardWidth = 180;
  const boardX = canvas.width - boardWidth - 16;
  const boardY = 16;

  ctx.save();

  entries.forEach((entry, index) => {
    const y = boardY + 6 + index * 16;
    const nameColor = getShipDisplayColor(entry);
    const alpha = entry.isCurrentPlayer ? 0.92 : 0.78;

    ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, 0.4);
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}.`, boardX + 4, y);

    ctx.fillStyle = hexToRgba(nameColor, alpha);
    ctx.fillText(entry.name, boardX + 22, y);

    ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, 0.55);
    ctx.textAlign = 'right';
    ctx.fillText(entry.score.toString(), boardX + boardWidth - 4, y);
  });

  ctx.restore();
}
