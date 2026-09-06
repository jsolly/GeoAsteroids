import { PALETTE, VISUAL } from '../../constants';
import type { Player } from '../../entities/player/Player';
import { getFactionColor, hexToRgba } from '../../utils/colorUtils';
import { hudFont } from './typography';

interface LeaderboardEntry {
  name: string;
  score: number;
  type: 'local' | 'remote' | 'bot';
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
      isCurrentPlayer: player.id === currentPlayerId,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const boardWidth = 180;
  const boardX = canvas.width - boardWidth - VISUAL.HUD_PAD;
  const boardY = VISUAL.HUD_PAD;

  ctx.save();
  ctx.font = hudFont(12);

  entries.forEach((entry, index) => {
    const y = boardY + 6 + index * 16;
    const nameColor = getFactionColor(entry.type);
    const alpha = entry.isCurrentPlayer ? 1 : 0.78;

    ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, entry.isCurrentPlayer ? 0.85 : 0.55);
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}.`, boardX + 4, y);

    ctx.fillStyle = hexToRgba(nameColor, alpha);
    ctx.fillText(entry.name, boardX + 22, y);

    ctx.fillStyle = hexToRgba(PALETTE.HUD, entry.isCurrentPlayer ? 0.92 : 0.7);
    ctx.textAlign = 'right';
    ctx.fillText(entry.score.toString(), boardX + boardWidth - 4, y);
  });

  ctx.restore();
}
