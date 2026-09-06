import { FACTION_LABELS, getSideColor } from '../../../shared/factions';
import type { FactionId } from '../../../shared-types';
import { PALETTE, SHIP, VISUAL } from '../../constants';
import { GameStateManager } from '../../core/services/GameStateManager';
import { PlayerManager } from '../../entities/player/PlayerManager';
import { getShipKit } from '../../entities/ship/shipKits';
import { hexToRgba } from '../../utils/colorUtils';

export function drawScoreOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  score: number,
  faction?: FactionId
): void {
  ctx.save();
  ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, 0.85);
  ctx.font = VISUAL.SCORE_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const scoreY = 20 + SHIP.SIZE + 8;
  ctx.fillText(score.toString(), 20, scoreY);
  if (faction) {
    ctx.fillStyle = hexToRgba(getSideColor(faction), 0.85);
    ctx.fillText(FACTION_LABELS[faction], 20, scoreY + 14);
  }

  const localShip = PlayerManager.getInstance().getLocalShip();
  if (localShip) {
    const kit = getShipKit(localShip.kitId);
    ctx.font = VISUAL.NAME_LABEL_FONT;
    ctx.fillText(kit.name, 20, scoreY + 28);
  }

  const gameStateManager = GameStateManager.getInstance();
  if (gameStateManager.hasKillMessage()) {
    ctx.fillStyle = PALETTE.DANGER;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameStateManager.getKillMessage(), canvas.width / 2, 12);
  }

  ctx.restore();
}

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
  ctx.save();

  const isDeathMessage = text.toLowerCase().includes('killed by');
  const isGameOver = text.toLowerCase().includes('game over');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  if (isGameOver) {
    ctx.fillStyle = hexToRgba(PALETTE.BG, alpha * 0.8);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = hexToRgba(PALETTE.DANGER, alpha);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', centerX, centerY - 80);

    if (isDeathMessage) {
      const deathCause = text.replace(/^Game Over:\s*/i, '');
      ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxWidth = canvas.width * 0.8;
      drawMultiLineText(ctx, deathCause, centerX, centerY + 20, maxWidth, 32, alpha);
    }

    ctx.fillStyle = hexToRgba(PALETTE.HUD_MUTED, alpha * 0.8);
    ctx.font = '16px Arial';
    ctx.fillText('Returning to main menu...', centerX, centerY + 120);
  } else if (isDeathMessage) {
    ctx.fillStyle = hexToRgba(PALETTE.BG, alpha * 0.7);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = canvas.width * 0.8;
    drawMultiLineText(ctx, text, centerX, centerY, maxWidth, 36, alpha);
  } else {
    ctx.fillStyle = hexToRgba(PALETTE.HUD, alpha);
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = canvas.width * 0.8;
    drawMultiLineText(ctx, text, canvas.width / 2, canvas.height / 2, maxWidth, 40, alpha);
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
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const canvasHeight = _canvas.height;
  ctx.fillText(`debug  asteroids ${roidCount}`, 10, canvasHeight - 28);

  ctx.restore();
}
