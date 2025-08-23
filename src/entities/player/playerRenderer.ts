import { getCTX, getCVS } from '../../constants/rendering/canvas';
import type { Ship } from '../ship/Ship';
import type { Player } from './types';

// Interface for boundary objects
interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Player-specific rendering functions
export function drawPlayer(player: Player, shipPosition: { x: number; y: number }): void {
  const ctx = getCTX();
  const cvs = getCVS();

  if (!ctx || !cvs || player.ship.exploding) {
    return;
  }

  // Convert world coordinates to screen coordinates
  const screenX = player.ship.position.x - shipPosition.x + cvs.width / 2;
  const screenY = player.ship.position.y - shipPosition.y + cvs.height / 2;

  // Draw player ship
  drawPlayerShip(ctx, screenX, screenY, player.ship, player.color);
}

function drawPlayerShip(
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

  // Draw ship body
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  // Ship shape (triangle pointing up)
  ctx.beginPath();
  ctx.moveTo(0, -ship.r);
  ctx.lineTo(-ship.r * 0.6, ship.r * 0.8);
  ctx.lineTo(ship.r * 0.6, ship.r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw thrusters if thrusting
  if (ship.thrusting) {
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(-ship.r * 0.4, ship.r * 0.8);
    ctx.lineTo(0, ship.r * 1.2);
    ctx.lineTo(ship.r * 0.4, ship.r * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // Draw health bar
  if (ship.health < ship.maxHealth) {
    const healthBarWidth = ship.r * 1.2;
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

export function drawPlayerMiniMap(
  player: Player,
  boundary: Boundary,
  ctx: CanvasRenderingContext2D
): void {
  if (player.ship.exploding) {
    return;
  }

  // Convert world coordinates to mini-map coordinates
  const miniMapScale = 0.1;
  const miniMapX = (player.ship.position.x - boundary.x) * miniMapScale;
  const miniMapY = (player.ship.position.y - boundary.y) * miniMapScale;

  // Draw player dot on mini-map
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(miniMapX, miniMapY, 3, 0, Math.PI * 2);
  ctx.fill();
}
