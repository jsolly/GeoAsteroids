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
