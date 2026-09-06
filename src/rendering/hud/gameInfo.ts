import { PALETTE, VISUAL } from '../../constants';
import { GameStateManager } from '../../core/services/GameStateManager';
import { SCORE_LABEL } from '../../ui/copy';
import { hexToRgba } from '../../utils/colorUtils';
import { drawHudHealthBar } from './healthBar';
import { formatScore, parseOverlayText } from './overlayCopy';
import { hudFont } from './typography';

const LIVES_CLUSTER_HEIGHT = VISUAL.LIVES_ICON_SIZE + 6;

export function hudScoreTop(): number {
  return VISUAL.HUD_PAD + LIVES_CLUSTER_HEIGHT;
}

export function hudHealthTop(): number {
  return hudScoreTop() + 22;
}

export function drawScoreOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  score: number
): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const x = VISUAL.HUD_PAD;
  const y = hudScoreTop();

  ctx.fillStyle = PALETTE.HUD_MUTED;
  ctx.font = hudFont(10);
  ctx.fillText(SCORE_LABEL, x, y);

  ctx.fillStyle = PALETTE.HUD;
  ctx.font = hudFont(16);
  ctx.fillText(formatScore(score), x + 52, y - 2);

  const gameStateManager = GameStateManager.getInstance();
  if (gameStateManager.hasKillMessage()) {
    ctx.fillStyle = PALETTE.DANGER;
    ctx.font = hudFont(13);
    ctx.textAlign = 'center';
    ctx.fillText(gameStateManager.getKillMessage(), canvas.width / 2, VISUAL.HUD_PAD);
  }

  ctx.restore();
}

export function drawLocalHudHealth(
  ctx: CanvasRenderingContext2D,
  health: number,
  maxHealth: number
): void {
  drawHudHealthBar(ctx, health, maxHealth, VISUAL.HUD_PAD, hudHealthTop());
}

function drawMultiLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const lineY = y + (i - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, x, lineY);
  }
}

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  alpha: number
): void {
  const copy = parseOverlayText(text);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxWidth = canvas.width * 0.72;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (copy.kind === 'gameOver') {
    ctx.fillStyle = hexToRgba(PALETTE.BG, alpha * 0.45);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (copy.title) {
      ctx.fillStyle = hexToRgba(PALETTE.DANGER, alpha);
      ctx.font = hudFont(36);
      ctx.fillText(copy.title, centerX, centerY - 36);
    }

    if (copy.detail) {
      ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
      ctx.font = hudFont(16);
      drawMultiLineText(ctx, copy.detail, centerX, centerY + 8, maxWidth, 22);
    }

    if (copy.hint) {
      ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, alpha);
      ctx.font = hudFont(12);
      ctx.fillText(copy.hint, centerX, centerY + 64);
    }
  } else if (copy.kind === 'death') {
    ctx.fillStyle = hexToRgba(PALETTE.BG, alpha * 0.3);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
    ctx.font = hudFont(18);
    drawMultiLineText(ctx, copy.detail, centerX, centerY, maxWidth, 24);
  } else {
    ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
    ctx.font = hudFont(20);
    drawMultiLineText(ctx, copy.detail, centerX, centerY, maxWidth, 26);
  }

  ctx.restore();
}

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
  ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, 0.7);
  ctx.font = hudFont(11);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`debug  asteroids ${roidCount}`, VISUAL.HUD_PAD, _canvas.height - 28);
  ctx.restore();
}
