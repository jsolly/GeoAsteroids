import { GameStateManager } from '../../core/services/GameStateManager';

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

  // Check if we should show a kill message instead of score
  const gameStateManager = GameStateManager.getInstance();
  if (gameStateManager.hasKillMessage()) {
    // Show kill message with slightly different styling
    ctx.fillStyle = '#ff4444'; // Red color for kill message
    ctx.font = 'bold 18px Arial';
    ctx.fillText(gameStateManager.getKillMessage(), canvas.width / 2, 20);
  } else {
    // Draw just the score number centered at top
    ctx.fillText(score.toString(), canvas.width / 2, 20);
  }

  ctx.restore();
}

// Helper function to draw multi-line text with word wrapping
function drawMultiLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  _alpha: number
): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const lineY = y + (i - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(lines[i], x, lineY);
  }
}

// Helper function to draw text overlay (game messages, etc.)
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  alpha: number
): void {
  ctx.save();

  // Check if this is a death message (contains "killed by")
  const isDeathMessage = text.toLowerCase().includes('killed by');
  const isGameOver = text.toLowerCase().includes('game over');

  if (isDeathMessage) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (isGameOver) {
      // Enhanced styling for final game over messages
      // Draw background overlay for better readability
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw main game over text
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', centerX, centerY - 80);

      // Draw death cause text (remove "Game Over:" prefix)
      const deathCause = text.replace('Game Over: ', '');
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Use multi-line text for death cause
      const maxWidth = canvas.width * 0.8; // 80% of screen width
      drawMultiLineText(ctx, deathCause, centerX, centerY + 20, maxWidth, 32, alpha);

      // Draw subtitle
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.8})`;
      ctx.font = '16px Arial';
      ctx.fillText('Returning to main menu...', centerX, centerY + 120);
    } else {
      // Styling for life loss messages with backdrop
      // Draw background overlay for better readability
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw death message in center with multi-line support
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Use multi-line text for death messages
      const maxWidth = canvas.width * 0.8; // 80% of screen width
      drawMultiLineText(ctx, text, centerX, centerY, maxWidth, 36, alpha);
    }
  } else {
    // Standard text overlay for other messages
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Use multi-line text for other messages too
    const maxWidth = canvas.width * 0.8; // 80% of screen width
    drawMultiLineText(ctx, text, canvas.width / 2, canvas.height / 2, maxWidth, 40, alpha);
  }

  ctx.restore();
}

// Helper function to draw debug information
export function drawDebugInfo(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  roidCount: number,
  debugMode: boolean
): void {
  if (!debugMode) {
    return;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Draw debug info in top-left corner
  ctx.fillText(`DEBUG MODE`, 10, 10);
  ctx.fillText(`Asteroids: ${roidCount}`, 10, 30);

  ctx.restore();
}
