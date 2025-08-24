import type { Player } from '../../entities/player/Player';

interface LeaderboardEntry {
  name: string;
  score: number;
  type: 'local' | 'remote' | 'bot';
  isCurrentPlayer?: boolean;
}

// Helper function to draw multiplayer leaderboard
export function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  players: Player[],
  currentPlayerId: string
): void {
  if (players.length === 0) {
    return;
  }

  // Prepare leaderboard data
  const entries: LeaderboardEntry[] = players
    .map((player) => ({
      name: player.name,
      score: player.score,
      type: player.type,
      isCurrentPlayer: player.id === currentPlayerId,
    }))
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, 10); // Show top 10

  // Leaderboard position and styling (top right, like slither.io)
  const boardWidth = 260;
  const boardX = canvas.width - boardWidth - 20;
  const boardY = 20; // Top-right anchored

  ctx.save();

  // Draw entries
  entries.forEach((entry, index) => {
    const y = boardY + 8 + index * 22;

    // Rank
    ctx.fillStyle = 'rgba(170, 170, 170, 0.4)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}.`, boardX + 8, y);

    // Player name with type indicator
    let nameColor = '#ffffff';
    let namePrefix = '';

    switch (entry.type) {
      case 'local':
        nameColor = '#ffffff'; // Bright white for local player (higher contrast)
        namePrefix = '';
        break;
      case 'remote':
        nameColor = '#00aaff'; // Blue for remote players
        namePrefix = '';
        break;
      case 'bot':
        nameColor = '#ff8800'; // Orange for bots
        namePrefix = 'Bot: ';
        break;
    }

    // Convert hex colors to rgba with transparency
    let transparentColor = nameColor;
    if (nameColor.startsWith('#')) {
      const r = parseInt(nameColor.slice(1, 3), 16);
      const g = parseInt(nameColor.slice(3, 5), 16);
      const b = parseInt(nameColor.slice(5, 7), 16);
      transparentColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
    }
    ctx.fillStyle = transparentColor;
    ctx.font = '12px Arial';
    // Use full names - no truncation needed
    ctx.fillText(`${namePrefix}${entry.name}`, boardX + 28, y);

    // Score - use consistent positioning for all scores
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(entry.score.toString(), boardX + boardWidth - 8, y);
  });

  ctx.restore();
}
