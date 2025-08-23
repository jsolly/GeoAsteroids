import type { Player } from '../../entities/player/Player';

interface LeaderboardEntry {
  name: string;
  score: number;
  type: 'local' | 'remote' | 'bot';
  isCurrentPlayer?: boolean;
}

// Helper function to draw score overlay
export function drawScoreOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  score: number
): void {
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Draw current score centered at top
  ctx.fillText(`Score: ${score}`, canvas.width / 2, 20);

  ctx.restore();
}

// Helper function to draw text overlay (game messages, etc.)
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  alpha: number
): void {
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.font = '32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw text in center of screen
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  ctx.restore();
}

// Helper function to draw player lives indicator
export function drawLivesIndicator(
  ctx: CanvasRenderingContext2D,
  lives: number,
  shipColor: string
): void {
  ctx.save();

  // Draw ship icons for lives
  const shipSize = 12; // Size of each ship triangle
  const spacing = 20; // Space between ships
  const startX = 20;
  const startY = 85;

  for (let i = 0; i < lives; i++) {
    const x = startX + i * spacing;
    const y = startY;

    // Draw ship triangle
    ctx.beginPath();
    ctx.moveTo(x, y + shipSize); // Bottom left
    ctx.lineTo(x + shipSize, y + shipSize); // Bottom right
    ctx.lineTo(x + shipSize / 2, y); // Top center
    ctx.closePath();

    // Fill with ship color
    ctx.fillStyle = shipColor;
    ctx.fill();

    // Add white outline for visibility
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
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

  // Leaderboard position and styling (below mini-map in top right)
  const boardWidth = 250;
  const boardHeight = Math.min(entries.length * 25 + 40, 300);
  const boardX = canvas.width - boardWidth - 20;
  const boardY = 200; // Position below mini-map

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(boardX, boardY, boardWidth, boardHeight);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Leaderboard', boardX + boardWidth / 2, boardY + 20);

  // Draw entries
  entries.forEach((entry, index) => {
    const y = boardY + 40 + index * 25;

    // Highlight current player
    if (entry.isCurrentPlayer) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.fillRect(boardX + 5, y - 12, boardWidth - 10, 20);
    }

    // Rank
    ctx.fillStyle = '#cccccc';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}.`, boardX + 10, y);

    // Player name with type indicator
    let nameColor = '#ffffff';
    let namePrefix = '';

    switch (entry.type) {
      case 'local':
        nameColor = '#00ff00'; // Green for local player
        namePrefix = '👤 ';
        break;
      case 'remote':
        nameColor = '#00aaff'; // Blue for remote players
        namePrefix = '🌐 ';
        break;
      case 'bot':
        nameColor = '#ff8800'; // Orange for bots
        namePrefix = '🤖 ';
        break;
    }

    ctx.fillStyle = nameColor;
    ctx.fillText(`${namePrefix}${entry.name}`, boardX + 35, y);

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(entry.score.toString(), boardX + boardWidth - 10, y);
  });

  ctx.restore();
}

// Helper function to draw framerate
export function drawFramerate(ctx: CanvasRenderingContext2D, fps: number): void {
  ctx.save();

  // Position at top left, below the score
  const fpsX = 20;
  const fpsY = 120;

  ctx.fillStyle = '#00ff00'; // Green color for FPS
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Draw FPS with color coding
  let fpsColor = '#00ff00'; // Green for good FPS
  if (fps < 30) {
    fpsColor = '#ff0000'; // Red for low FPS
  } else if (fps < 50) {
    fpsColor = '#ffff00'; // Yellow for medium FPS
  }

  ctx.fillStyle = fpsColor;
  ctx.fillText(`FPS: ${Math.round(fps)}`, fpsX, fpsY);

  ctx.restore();
}

// Helper function to draw connection status
export function drawConnectionStatus(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  isConnected: boolean,
  playerCount: number,
  remoteHumanCount: number,
  botCount: number
): void {
  ctx.save();

  // Position at top right, above mini-map
  const statusX = canvas.width - 20;
  const statusY = 20;

  ctx.textAlign = 'right';
  ctx.font = '14px Arial';

  // Connection indicator
  if (isConnected) {
    ctx.fillStyle = '#00ff00';
    ctx.fillText('🟢 Online', statusX, statusY);
  } else {
    ctx.fillStyle = '#ff0000';
    ctx.fillText('🔴 Offline', statusX, statusY);
  }

  // Player counts
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Players: ${playerCount}`, statusX, statusY + 20);

  if (remoteHumanCount > 0) {
    ctx.fillStyle = '#00aaff';
    ctx.fillText(`🌐 Remote: ${remoteHumanCount}`, statusX, statusY + 40);
  }

  if (botCount > 0) {
    ctx.fillStyle = '#ff8800';
    ctx.fillText(`🤖 Bots: ${botCount}`, statusX, statusY + 60);
  }

  ctx.restore();
}
