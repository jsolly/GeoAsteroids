import { GAME, LASER, PALETTE, SHIP, VISUAL } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import { isDebugMode } from '../../utils/debugUtils';
import { logger } from '../../utils/Logger';

import type { Ship } from './Ship';

const shipTriangle = {
  nose: { x: 0, y: 0 },
  rearLeft: { x: 0, y: 0 },
  rearRight: { x: 0, y: 0 },
};

const thrusterGeom = {
  rearCenter: { x: 0, y: 0 },
  flameTip: { x: 0, y: 0 },
  leftFlame: { x: 0, y: 0 },
  rightFlame: { x: 0, y: 0 },
};

const laserScreen = { x: 0, y: 0 };
const rotA = { x: 0, y: 0 };
const rotB = { x: 0, y: 0 };

// Helper function to calculate ship triangle points for consistent ship rendering
export function calculateShipTrianglePoints(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
): {
  nose: { x: number; y: number };
  rearLeft: { x: number; y: number };
  rearRight: { x: number; y: number };
} {
  // Create a more isosceles triangle shape for better ship appearance
  shipTriangle.nose.x = centerX + radius * Math.cos(angle);
  shipTriangle.nose.y = centerY - radius * Math.sin(angle);
  shipTriangle.rearLeft.x = centerX - radius * 0.8 * Math.cos(angle) + radius * 0.5 * Math.sin(angle);
  shipTriangle.rearLeft.y = centerY + radius * 0.8 * Math.sin(angle) + radius * 0.5 * Math.cos(angle);
  shipTriangle.rearRight.x = centerX - radius * 0.8 * Math.cos(angle) - radius * 0.5 * Math.sin(angle);
  shipTriangle.rearRight.y = centerY + radius * 0.8 * Math.sin(angle) - radius * 0.5 * Math.cos(angle);
  return shipTriangle;
}

// Helper function to draw a targeting line extending from the ship
export function drawTargetingLine(
  centerX: number,
  centerY: number,
  angle: number,
  shipRadius: number,
  lineLength: number = 300,
  color: string = PALETTE.HUD,
  alpha: number = 0.6
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  // Calculate end point of the targeting line
  const endX = centerX + Math.cos(angle) * (shipRadius + lineLength);
  const endY = centerY - Math.sin(angle) * (shipRadius + lineLength);

  // Set line style with transparency
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Dashed line for better visibility

  // Draw the targeting line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Reset line style
  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;
}

export function drawGenericThruster(
  x: number,
  y: number,
  angle: number,
  radius: number,
  color: string = PALETTE.LOCAL
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  // The hull's rear edge sits 0.8r behind centre; the trail is an open V hanging off it.
  const rearCenter = thrusterGeom.rearCenter;
  rearCenter.x = x - radius * 0.8 * Math.cos(angle);
  rearCenter.y = y + radius * 0.8 * Math.sin(angle);

  const flicker = Math.floor(performance.now() / VISUAL.THRUSTER_FLICKER_MS) % 2 === 0;
  const lengthRatio = flicker ? VISUAL.THRUSTER_LENGTH_RATIO : VISUAL.THRUSTER_FLICKER_RATIO;
  const flameLength = radius * lengthRatio;
  const halfWidth = radius * 0.2;
  const flameTip = thrusterGeom.flameTip;
  flameTip.x = rearCenter.x - Math.cos(angle) * flameLength;
  flameTip.y = rearCenter.y + Math.sin(angle) * flameLength;
  const leftFlame = thrusterGeom.leftFlame;
  leftFlame.x = rearCenter.x + Math.sin(angle) * halfWidth;
  leftFlame.y = rearCenter.y + Math.cos(angle) * halfWidth;
  const rightFlame = thrusterGeom.rightFlame;
  rightFlame.x = rearCenter.x - Math.sin(angle) * halfWidth;
  rightFlame.y = rearCenter.y - Math.cos(angle) * halfWidth;

  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.THRUSTER_GLOW;
  ctx.strokeStyle = color;
  ctx.lineWidth = VISUAL.THRUSTER_STROKE_WIDTH;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(leftFlame.x, leftFlame.y);
  ctx.lineTo(flameTip.x, flameTip.y);
  ctx.lineTo(rightFlame.x, rightFlame.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawThruster(ship: Ship, color: string = ship.color): void {
  const cvs = canvasManager.getCanvas();
  if (!cvs) {
    return;
  }

  if (!ship.exploding && ship.thrusting) {
    drawGenericThruster(cvs.width / 2, cvs.height / 2, ship.angle, ship.r, color);
  }
}

export function drawThrusterAtPosition(
  ship: Ship,
  shipPosition: { x: number; y: number },
  color: string = ship.color
): void {
  const cvs = canvasManager.getCanvas();
  if (!cvs) {
    return;
  }

  if (!ship.exploding && ship.thrusting) {
    const screenX = ship.position.x - shipPosition.x + cvs.width / 2;
    const screenY = ship.position.y - shipPosition.y + cvs.height / 2;
    const cull = ship.r * 3;
    if (screenX < -cull || screenY < -cull || screenX > cvs.width + cull || screenY > cvs.height + cull) {
      return;
    }
    drawGenericThruster(screenX, screenY, ship.angle, ship.r, color);
  }
}

// Helper function to draw player name under ship
export function drawPlayerName(
  name: string,
  x: number,
  y: number,
  shipRadius: number,
  color: string = PALETTE.HUD
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const nameY = y + shipRadius + 14;

  ctx.fillStyle = hexToRgba(color, 0.7);
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x, nameY);
}

// Classic vector break-up: the three hull edges drift apart along their outward normals and fade,
// with a few hairline sparks — no filled fireball.
function drawVectorExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  progress: number,
  color: string
): void {
  const t = Math.min(Math.max(progress, 0), 1);
  const alpha = 1 - t * 0.85;
  const spread = radius * VISUAL.EXPLOSION_SPREAD_RATIO * t;
  const { nose, rearLeft, rearRight } = calculateShipTrianglePoints(x, y, radius, angle);
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [nose, rearLeft],
    [rearLeft, rearRight],
    [rearRight, nose],
  ];

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.EXPLOSION_STROKE_WIDTH;
  ctx.lineWidth = VISUAL.EXPLOSION_STROKE_WIDTH;
  ctx.lineCap = 'butt';

  for (const [a, b] of edges) {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const len = Math.hypot(midX - x, midY - y) || 1;
    const dx = ((midX - x) / len) * spread;
    const dy = ((midY - y) / len) * spread;
    // Fragments tumble slightly as they fly.
    const spin = t * 0.6;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    rotA.x = midX + dx + (a.x - midX) * cos - (a.y - midY) * sin;
    rotA.y = midY + dy + (a.x - midX) * sin + (a.y - midY) * cos;
    rotB.x = midX + dx + (b.x - midX) * cos - (b.y - midY) * sin;
    rotB.y = midY + dy + (b.x - midX) * sin + (b.y - midY) * cos;
    ctx.beginPath();
    ctx.moveTo(rotA.x, rotA.y);
    ctx.lineTo(rotB.x, rotB.y);
    ctx.stroke();
  }

  const sparkInner = radius * (0.4 + t * 1.2);
  const sparkOuter = sparkInner + radius * 0.25 * (1 - t);
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI) / 3 + 0.35;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * sparkInner, y - Math.sin(a) * sparkInner);
    ctx.lineTo(x + Math.cos(a) * sparkOuter, y - Math.sin(a) * sparkOuter);
    ctx.stroke();
  }
  ctx.restore();
}

function explosionProgress(ship: Ship): number {
  return 1 - ship.explodeTime / SHIP.EXPLODE_DURATION_FRAMES;
}

export function drawShipExplosion(ship: Ship, color?: string): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  drawVectorExplosion(
    ctx,
    cvs.width / 2,
    cvs.height / 2,
    ship.r,
    ship.angle,
    explosionProgress(ship),
    color || ship.color || PALETTE.LOCAL
  );
}

export function drawShipExplosionAtPosition(
  ship: Ship,
  shipPosition: { x: number; y: number },
  color?: string
): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  const screenX = ship.position.x - shipPosition.x + cvs.width / 2;
  const screenY = ship.position.y - shipPosition.y + cvs.height / 2;
  drawVectorExplosion(
    ctx,
    screenX,
    screenY,
    ship.r,
    ship.angle,
    explosionProgress(ship),
    color || ship.color || PALETTE.REMOTE
  );
}

export function drawLasers(
  ship: Ship,
  color?: string,
  viewerShipPosition?: { x: number; y: number }
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const boltColor = color || PALETTE.LASER_LOCAL;
  const cvs = canvasManager.getCanvas();
  const viewW = cvs?.width ?? Number.POSITIVE_INFINITY;
  const viewH = cvs?.height ?? Number.POSITIVE_INFINITY;
  const cullPad = VISUAL.LASER_LENGTH + VISUAL.LASER_EXPLODE_RADIUS;

  ctx.shadowColor = boltColor;
  ctx.shadowBlur = VISUAL.LASER_GLOW;
  ctx.lineCap = 'butt';

  for (const laser of ship.lasers) {
    const referencePos = viewerShipPosition || ship.position;
    const screenPos = canvasManager.worldToScreenInto(laserScreen, laser.position, referencePos);
    if (
      screenPos.x < -cullPad ||
      screenPos.y < -cullPad ||
      screenPos.x > viewW + cullPad ||
      screenPos.y > viewH + cullPad
    ) {
      continue;
    }

    if (laser.explodeTime === 0) {
      // Classic Asteroids shot: a short hard-edged segment centred on the laser position,
      // aligned to its heading. Butt caps keep it a crisp vector dash, not a bloomed pill.
      const speed = Math.hypot(laser.velocity.x, laser.velocity.y);
      const halfX = (speed > 0 ? laser.velocity.x / speed : 1) * (VISUAL.LASER_LENGTH / 2);
      const halfY = (speed > 0 ? laser.velocity.y / speed : 0) * (VISUAL.LASER_LENGTH / 2);
      ctx.strokeStyle = boltColor;
      ctx.lineWidth = VISUAL.LASER_STROKE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(screenPos.x - halfX, screenPos.y - halfY);
      ctx.lineTo(screenPos.x + halfX, screenPos.y + halfY);
      ctx.stroke();
    } else {
      // Impact flash: a hairline ring that expands and fades over the short explode window.
      const t = 1 - laser.explodeTime / Math.ceil(LASER.EXPLODE_DURATION * GAME.FPS);
      const ringRadius = VISUAL.LASER_EXPLODE_RADIUS * (0.5 + t);
      ctx.strokeStyle = hexToRgba(boltColor, 1 - t * 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
}

export function drawEmpPulse(ship: Ship, empRadius: number, empAlpha: number): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  const centerX = cvs.width / 2;
  const centerY = cvs.height / 2;

  // Create a radial gradient for the EMP effect
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, empRadius);

  // Electric blue to transparent effect
  gradient.addColorStop(0, `rgba(0, 255, 255, ${empAlpha * 0.8})`); // Cyan center
  gradient.addColorStop(0.3, `rgba(0, 150, 255, ${empAlpha * 0.6})`); // Blue
  gradient.addColorStop(0.7, `rgba(0, 100, 255, ${empAlpha * 0.4})`); // Darker blue
  gradient.addColorStop(1, `rgba(0, 50, 255, ${empAlpha * 0.1})`); // Very faint blue

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, empRadius, 0, Math.PI * 2, false);
  ctx.fill();

  // Add electric arc effects
  ctx.strokeStyle = `rgba(0, 255, 255, ${empAlpha})`;
  ctx.lineWidth = 2;

  // Draw some random electric arcs
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const startX = centerX + Math.cos(angle) * ship.r;
    const startY = centerY + Math.sin(angle) * ship.r;
    const endX = centerX + Math.cos(angle) * empRadius;
    const endY = centerY + Math.sin(angle) * empRadius;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

// Ship rendering with world coordinates (for other players)
export function drawShipAtPosition(
  ship: Ship,
  shipPosition: { x: number; y: number },
  color?: string,
  playerName?: string
): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();

  if (!ctx || !cvs || ship.exploding) {
    return;
  }

  // Apply blinking effect for invincibility
  if (ship.blinkCount > 0 && !ship.blinkOn) {
    return; // Skip rendering this frame
  }

  // Convert world coordinates to screen coordinates
  const screenX = ship.position.x - shipPosition.x + cvs.width / 2;
  const screenY = ship.position.y - shipPosition.y + cvs.height / 2;

  const cull = ship.r * 3;
  if (screenX < -cull || screenY < -cull || screenX > cvs.width + cull || screenY > cvs.height + cull) {
    return;
  }

  // Use ship's own color or provided color
  const shipColor = color || ship.color;

  // Use the shared ship triangle calculation function for consistency
  const { nose, rearLeft, rearRight } = calculateShipTrianglePoints(
    screenX,
    screenY,
    ship.r,
    ship.angle
  );

  ctx.strokeStyle = shipColor;
  ctx.lineWidth = VISUAL.SHIP_STROKE_WIDTH;
  ctx.shadowColor = shipColor;
  ctx.shadowBlur = VISUAL.SHIP_GLOW;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(rearLeft.x, rearLeft.y);
  ctx.lineTo(rearRight.x, rearRight.y);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawFloatingHealthCapsule(ctx, ship, screenX, screenY);

  // Draw player name under ship if provided
  if (playerName) {
    drawPlayerName(playerName, screenX, screenY, ship.r, shipColor);
  }
}

function drawFloatingHealthCapsule(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  screenX: number,
  screenY: number
): void {
  const damaged = ship.health < ship.maxHealth;
  if (!damaged && !isDebugMode()) {
    return;
  }

  const barWidth = ship.r * 2.4;
  const barY = screenY - ship.r - 10;
  const barX = screenX - barWidth / 2;
  const healthPercent = Math.max(0, ship.health / ship.maxHealth);
  const currentWidth = barWidth * healthPercent;

  // Two hairline strokes: a muted track and the remaining-health segment on top.
  ctx.save();
  ctx.lineWidth = VISUAL.HEALTH_CAPSULE_HEIGHT;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = hexToRgba(PALETTE.HUD_MUTED, 0.45);
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + barWidth, barY);
  ctx.stroke();
  if (currentWidth > 0) {
    ctx.strokeStyle = PALETTE.HEALTH;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + currentWidth, barY);
    ctx.stroke();
  }

  if (isDebugMode()) {
    ctx.fillStyle = PALETTE.HUD;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(ship.health)}/${ship.maxHealth}`, screenX, barY - 10);
  }
  ctx.restore();
}

// Helper function to draw player health bar in the HUD
export function drawPlayerHealthBar(health: number, maxHealth: number): void {
  const ctx = canvasManager.getContext();
  const canvas = canvasManager.getCanvas();
  if (!ctx || !canvas) {
    return;
  }

  // Debug logging for health bar values
  if (health !== maxHealth) {
    logger.debug('HEALTH_BAR', 'Drawing health bar with non-full health', {
      health,
      maxHealth,
      healthPercent: health / maxHealth,
    });
  }

  const barWidth = 200;
  const barHeight = 20;
  const barX = canvas.width - barWidth - 20;
  const barY = 20;

  // Health percentage
  const healthPercent = health / maxHealth;
  const currentWidth = barWidth * healthPercent;

  ctx.save();

  // Background (empty health bar)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Health bar color based on health level
  let healthColor: string;
  if (healthPercent > 0.6) {
    healthColor = '#00ff00'; // Green for high health
  } else if (healthPercent > 0.3) {
    healthColor = '#ffff00'; // Yellow for medium health
  } else {
    healthColor = '#ff0000'; // Red for low health
  }

  // Current health
  ctx.fillStyle = healthColor;
  ctx.fillRect(barX, barY, currentWidth, barHeight);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Health text
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(health)}/${maxHealth}`, barX + barWidth / 2, barY - 8);

  ctx.restore();
}
