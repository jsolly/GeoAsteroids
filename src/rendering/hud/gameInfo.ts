import { SHIP_SIZE } from '../../constants/entities/ship';
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

  // Draw just the score number centered at top
  ctx.fillText(score.toString(), canvas.width / 2, 20);

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
  const shipSize = SHIP_SIZE; // Match in-game ship size
  const spacing = shipSize + 10; // Space between ships
  const startX = 20;
  const startY = 20;

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
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

// Draw lives only (no panel, no other info)
export function drawLeftHudPanel(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  lives: number,
  shipColor: string,
  _fps: number,
  _isConnected: boolean,
  _playerCount: number,
  _remoteHumanCount: number,
  _botCount: number
): void {
  const startX = 20;
  const startY = 20;
  const shipSize = SHIP_SIZE;
  const spacing = shipSize + 10;

  // Draw three ship outlines for lives (no fill, just stroke like the ship)
  for (let i = 0; i < lives; i++) {
    const x = startX + i * spacing;
    const y = startY;

    ctx.beginPath();
    ctx.moveTo(x, y + shipSize);
    ctx.lineTo(x + shipSize, y + shipSize);
    ctx.lineTo(x + shipSize / 2, y);
    ctx.closePath();

    // No fill, just stroke like the ship
    ctx.strokeStyle = shipColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
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

    // Highlight current player
    if (entry.isCurrentPlayer) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.fillRect(boardX + 3, y - 10, boardWidth - 6, 18);
    }

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
        nameColor = '#00ff00'; // Green for local player
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
    // Truncate long names
    const maxNameLength = 12;
    const displayName =
      entry.name.length > maxNameLength
        ? `${entry.name.substring(0, maxNameLength - 1)}...`
        : entry.name;
    ctx.fillText(`${namePrefix}${displayName}`, boardX + 28, y);

    // Score
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(entry.score.toString(), boardX + boardWidth - 8, y);
  });

  ctx.restore();
}

// Helper function to draw framerate
export function drawFramerate(ctx: CanvasRenderingContext2D, fps: number): void {
  ctx.save();

  // Position at top left, below large lives icons
  const fpsX = 20;
  const fpsY = 20 + SHIP_SIZE + 8;

  ctx.fillStyle = '#00ff00'; // Green color for FPS
  ctx.font = '12px Arial';
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
  _canvas: HTMLCanvasElement,
  isConnected: boolean,
  playerCount: number,
  remoteHumanCount: number,
  botCount: number
): void {
  ctx.save();

  // Position at top left, below FPS counter
  const statusX = 20;
  const statusY = 20 + SHIP_SIZE + 8 + 18;

  ctx.textAlign = 'left';
  ctx.font = '12px Arial';

  // Connection indicator
  if (isConnected) {
    ctx.fillStyle = '#00ff00';
    ctx.fillText('🟢 Connected to main server', statusX, statusY);
  } else {
    ctx.fillStyle = '#ff0000';
    ctx.fillText('🔴 Disconnected', statusX, statusY);
  }

  // Player counts
  ctx.fillStyle = '#cccccc';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(`Players online: ${playerCount}`, statusX, statusY + 18);

  if (remoteHumanCount > 0) {
    ctx.fillStyle = '#00aaff';
    ctx.fillText(`🌐 Remote: ${remoteHumanCount}`, statusX, statusY + 36);
  }

  if (botCount > 0) {
    ctx.fillStyle = '#ff8800';
    ctx.fillText(`🤖 Bots: ${botCount}`, statusX, statusY + 54);
  }

  ctx.restore();
}
