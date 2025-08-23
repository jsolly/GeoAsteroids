import { SHIP_EXPLODE_DUR_FRAMES } from '../../constants/entities/ship';
import { getCTX, getCVS } from '../../constants/rendering/canvas';
import type { Ship } from '../ship/Ship';
import type { BotPlayer } from './BotPlayer';

// Interface for boundary objects
interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Bot-specific rendering functions
export function drawBot(bot: BotPlayer, shipPosition: { x: number; y: number }): void {
  const ctx = getCTX();
  const cvs = getCVS();

  if (!ctx || !cvs || bot.ship.exploding) {
    return;
  }

  // Convert world coordinates to screen coordinates
  const screenX = bot.ship.position.x - shipPosition.x + cvs.width / 2;
  const screenY = bot.ship.position.y - shipPosition.y + cvs.height / 2;

  // Draw bot ship
  drawBotShip(ctx, screenX, screenY, bot.ship, bot.color);
}

function drawBotShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ship: Ship,
  color: string
): void {
  // Skip rendering if ship is exploding
  if (ship.exploding) {
    return;
  }

  // Apply blinking effect for invincibility
  if (ship.blinkCount > 0 && !ship.blinkOn) {
    return; // Skip rendering this frame
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ship.angle);

  // Draw bot ship (slightly different from player ship)
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  // Bot ship shape (diamond shape to distinguish from players)
  ctx.beginPath();
  ctx.moveTo(0, -ship.r);
  ctx.lineTo(-ship.r * 0.7, 0);
  ctx.lineTo(0, ship.r);
  ctx.lineTo(ship.r * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw bot identifier
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('B', 0, 0);

  // Draw health bar
  if (ship.health < ship.maxHealth) {
    const healthBarWidth = ship.r * 1.4;
    const healthBarHeight = 4;
    const healthPercentage = ship.health / ship.maxHealth;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(-healthBarWidth / 2, -ship.r - 15, healthBarWidth, healthBarHeight);

    // Health bar
    ctx.fillStyle =
      healthPercentage > 0.5 ? '#00ff00' : healthPercentage > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(
      -healthBarWidth / 2,
      -ship.r - 15,
      healthBarWidth * healthPercentage,
      healthBarHeight
    );
  }

  ctx.restore();
}

export function drawBotExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ship: Ship,
  color: string
): void {
  if (!ship.exploding || ship.explodeTime <= 0) {
    return;
  }

  const explosionProgress = 1 - ship.explodeTime / SHIP_EXPLODE_DUR_FRAMES;
  const radius = ship.r * (1 + explosionProgress * 2);

  // Draw bot explosion (different from player explosion)
  ctx.save();
  ctx.translate(x, y);

  // Outer explosion ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - explosionProgress;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Bot-specific explosion particles (more mechanical looking)
  ctx.fillStyle = '#ff6600';
  ctx.globalAlpha = 1 - explosionProgress * 0.5;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const particleRadius = radius * 0.4 * explosionProgress;
    const px = Math.cos(angle) * particleRadius;
    const py = Math.sin(angle) * particleRadius;

    // Draw square particles for bots
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  ctx.restore();
}

export function drawBotMiniMap(
  bot: BotPlayer,
  boundary: Boundary,
  ctx: CanvasRenderingContext2D
): void {
  if (bot.ship.exploding) {
    return;
  }

  // Convert world coordinates to mini-map coordinates
  const miniMapScale = 0.1;
  const miniMapX = (bot.ship.position.x - boundary.x) * miniMapScale;
  const miniMapY = (bot.ship.position.y - boundary.y) * miniMapScale;

  // Draw bot dot on mini-map (different color/shape from players)
  ctx.fillStyle = bot.color;
  ctx.beginPath();
  ctx.arc(miniMapX, miniMapY, 2, 0, Math.PI * 2);
  ctx.fill();

  // Add bot identifier
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('B', miniMapX, miniMapY + 8);
}
