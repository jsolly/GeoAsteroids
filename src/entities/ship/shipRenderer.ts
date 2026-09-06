import type { SoftFactionId } from '../../../shared-types';
import { GAME, LASER, PALETTE, SHIP, TITLE, VISUAL } from '../../constants';
import { Point } from '../../physics/Point';
import { canvasManager } from '../../rendering/canvas';
import { hexToRgba } from '../../utils/colorUtils';
import { isDebugMode } from '../../utils/debugUtils';
import { logger } from '../../utils/Logger';
import { drawSoftFactionMark } from '../player/factionMarkPainters';
import { findHarpoonFieldBody } from './harpoonField';
import {
  getKitHullOutline,
  projectHullPoint,
  projectHullPolyline,
  projectKitHullEdges,
} from './hullOutlines';
import type { Ship } from './Ship';
import { CLASSIC_HULL, HAULER_TETHER_COLOR, type HullProfile, type ShipKitId } from './shipKits';

// Helper function to calculate ship triangle points for consistent ship rendering
export function calculateShipTrianglePoints(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  hull: HullProfile = CLASSIC_HULL
): {
  nose: { x: number; y: number };
  rearLeft: { x: number; y: number };
  rearRight: { x: number; y: number };
} {
  const nose = {
    x: centerX + radius * hull.nose * Math.cos(angle),
    y: centerY - radius * hull.nose * Math.sin(angle),
  };
  const rearLeft = {
    x: centerX - radius * hull.rear * Math.cos(angle) + radius * hull.beam * Math.sin(angle),
    y: centerY + radius * hull.rear * Math.sin(angle) + radius * hull.beam * Math.cos(angle),
  };
  const rearRight = {
    x: centerX - radius * hull.rear * Math.cos(angle) - radius * hull.beam * Math.sin(angle),
    y: centerY + radius * hull.rear * Math.sin(angle) - radius * hull.beam * Math.cos(angle),
  };

  return { nose, rearLeft, rearRight };
}

/** Shared phosphor stroke for v2 kit outlines (and the leftover 3-point helper). */
export function strokePhosphorPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  color: string,
  closed = true
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point) {
        ctx.lineTo(point.x, point.y);
      }
    }
    if (closed) {
      ctx.closePath();
    }
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = VISUAL.SHIP_STROKE_WIDTH;
  ctx.shadowColor = color;
  ctx.shadowBlur = VISUAL.SHIP_GLOW;
  ctx.strokeStyle = hexToRgba(color, 0.4);
  trace();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  trace();
  ctx.stroke();
  ctx.restore();
}

export function strokePhosphorHull(
  ctx: CanvasRenderingContext2D,
  hull: {
    nose: { x: number; y: number };
    rearLeft: { x: number; y: number };
    rearRight: { x: number; y: number };
  },
  color: string
): void {
  strokePhosphorPolyline(ctx, [hull.nose, hull.rearLeft, hull.rearRight], color, true);
}

export function strokeKitHullOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  color: string,
  kitId?: ShipKitId
): void {
  const outline = getKitHullOutline(kitId);
  strokePhosphorPolyline(
    ctx,
    projectHullPolyline(centerX, centerY, radius, angle, outline.hull),
    color,
    outline.hull.closed
  );
  for (const extra of outline.extras) {
    strokePhosphorPolyline(
      ctx,
      projectHullPolyline(centerX, centerY, radius, angle, extra),
      color,
      extra.closed
    );
  }
}

export function strokePhosphorSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  glow: number
): void {
  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = hexToRgba(color, 0.5);
  trace();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  trace();
  ctx.stroke();
  ctx.restore();
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
  color: string = PALETTE.LOCAL,
  kitId?: ShipKitId
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  const aft = getKitHullOutline(kitId).thruster;
  const rearCenter = projectHullPoint(x, y, radius, angle, aft);

  const flicker = Math.floor(performance.now() / VISUAL.THRUSTER_FLICKER_MS) % 2 === 0;
  const lengthRatio = flicker ? VISUAL.THRUSTER_LENGTH_RATIO : VISUAL.THRUSTER_FLICKER_RATIO;
  const flameLength = radius * lengthRatio;
  const halfWidth = radius * 0.2;
  const flameTip = {
    x: rearCenter.x - Math.cos(angle) * flameLength,
    y: rearCenter.y + Math.sin(angle) * flameLength,
  };
  const leftFlame = {
    x: rearCenter.x + Math.sin(angle) * halfWidth,
    y: rearCenter.y + Math.cos(angle) * halfWidth,
  };
  const rightFlame = {
    x: rearCenter.x - Math.sin(angle) * halfWidth,
    y: rearCenter.y - Math.cos(angle) * halfWidth,
  };

  ctx.save();
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
  ctx.restore();
}

export function drawThruster(ship: Ship, color: string = ship.color): void {
  const cvs = canvasManager.getCanvas();
  if (!cvs) {
    return;
  }

  logger.debug('THRUSTER', 'drawThruster called', {
    exploding: ship.exploding,
    blinkOn: ship.blinkOn,
    thrusting: ship.thrusting,
    shipId: ship.id,
    shipPosition: ship.position,
    shipAngle: ship.angle,
    shipRadius: ship.r,
  });

  if (!ship.exploding && ship.thrusting) {
    // Ship is always drawn at screen center (viewport transformation)
    const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

    logger.debug('THRUSTER', 'Drawing thruster at screen center', {
      x: screenCenter.x,
      y: screenCenter.y,
      angle: ship.angle,
      radius: ship.r,
    });

    // Use the generic thruster function
    drawGenericThruster(screenCenter.x, screenCenter.y, ship.angle, ship.r, color, ship.kitId);
  } else {
    logger.debug('THRUSTER', 'Thruster not drawn - conditions not met', {
      exploding: ship.exploding,
      thrusting: ship.thrusting,
    });
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
    const screen = canvasManager.worldToScreen(ship.position, shipPosition);
    const scale = canvasManager.getPlayfieldScale();
    drawGenericThruster(screen.x, screen.y, ship.angle, ship.r * scale, color, ship.kitId);
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

  ctx.save();
  ctx.fillStyle = hexToRgba(color, VISUAL.NAME_LABEL_ALPHA);
  ctx.font = VISUAL.NAME_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x, nameY);
  ctx.restore();
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
  color: string,
  kitId?: ShipKitId
): void {
  const t = Math.min(Math.max(progress, 0), 1);
  const alpha = 1 - t * 0.85;
  const spread = radius * VISUAL.EXPLOSION_SPREAD_RATIO * t;
  const edges = projectKitHullEdges(x, y, radius, angle, kitId);

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
    const rot = (p: { x: number; y: number }) => ({
      x: midX + dx + (p.x - midX) * cos - (p.y - midY) * sin,
      y: midY + dy + (p.x - midX) * sin + (p.y - midY) * cos,
    });
    const a2 = rot(a);
    const b2 = rot(b);
    ctx.beginPath();
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(b2.x, b2.y);
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

  const screenCenter = new Point(cvs.width / 2, cvs.height / 2);
  drawVectorExplosion(
    ctx,
    screenCenter.x,
    screenCenter.y,
    ship.r * canvasManager.getPlayfieldScale(),
    ship.angle,
    explosionProgress(ship),
    color || ship.color || PALETTE.LOCAL,
    ship.kitId
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

  const screen = canvasManager.worldToScreen(ship.position, shipPosition);
  const scale = canvasManager.getPlayfieldScale();
  drawVectorExplosion(
    ctx,
    screen.x,
    screen.y,
    ship.r * scale,
    ship.angle,
    explosionProgress(ship),
    color || ship.color || PALETTE.REMOTE,
    ship.kitId
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

  for (const laser of ship.lasers) {
    const referencePos = viewerShipPosition || ship.position;
    const screenPos = canvasManager.worldToScreen(laser.position, referencePos);

    if (laser.explodeTime === 0) {
      // Short cream dash along heading — soft round caps + glow ≤ stroke (pins were invisible).
      const speed = Math.hypot(laser.velocity.x, laser.velocity.y);
      const bolt = (VISUAL.LASER_LENGTH / 2) * canvasManager.getPlayfieldScale();
      const halfX = (speed > 0 ? laser.velocity.x / speed : 1) * bolt;
      const halfY = (speed > 0 ? laser.velocity.y / speed : 0) * bolt;
      strokePhosphorSegment(
        ctx,
        screenPos.x - halfX,
        screenPos.y - halfY,
        screenPos.x + halfX,
        screenPos.y + halfY,
        boltColor,
        VISUAL.LASER_STROKE_WIDTH,
        VISUAL.LASER_GLOW
      );
    } else {
      // Impact flash: a hairline ring that expands and fades over the short explode window.
      const t = 1 - laser.explodeTime / Math.ceil(LASER.EXPLODE_DURATION * GAME.FPS);
      const ringRadius = VISUAL.LASER_EXPLODE_RADIUS * (0.5 + t);
      ctx.save();
      ctx.shadowColor = boltColor;
      ctx.shadowBlur = VISUAL.LASER_GLOW;
      ctx.strokeStyle = hexToRgba(boltColor, 1 - t * 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.restore();
    }
  }
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
  playerName?: string,
  factionId?: SoftFactionId
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

  const screen = canvasManager.worldToScreen(ship.position, shipPosition);
  const scale = canvasManager.getPlayfieldScale();
  const screenX = screen.x;
  const screenY = screen.y;
  const shipR = ship.r * scale;

  // Use ship's own color or provided color
  const shipColor = color || ship.color;

  strokeKitHullOutline(ctx, screenX, screenY, shipR, ship.angle, shipColor, ship.kitId);
  drawSoftFactionMark(ctx, factionId, {
    x: screenX,
    y: screenY,
    radius: shipR,
    angle: ship.angle,
  });
  drawAbilityFx(ctx, ship, screenX, screenY, shipR, shipPosition);

  drawShipImpactFlash(ctx, ship, screenX, screenY, shipR);
  drawFloatingHealthCapsule(ctx, ship, screenX, screenY, shipR);

  // Draw player name under ship if provided
  if (playerName) {
    drawPlayerName(playerName, screenX, screenY, shipR, shipColor);
  }
}

export function canDrawHaulerHarpoon(ship: {
  kitId: string;
  harpoonTimer: number;
  harpoonTargetId?: string;
}): boolean {
  return ship.kitId === 'hauler' && ship.harpoonTimer > 0 && Boolean(ship.harpoonTargetId);
}

/** Tether + latch ring. Hauler only — other kits never draw this. */
export function drawHaulerHarpoonVfx(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  screenX: number,
  screenY: number,
  cameraShipPosition: { x: number; y: number }
): void {
  if (!canDrawHaulerHarpoon(ship)) {
    return;
  }
  const target = findHarpoonFieldBody(ship.harpoonTargetId);
  if (!target) {
    return;
  }

  const latch = canvasManager.worldToScreen(target.position, cameraShipPosition);
  const pulse = 0.55 + 0.25 * Math.sin(Date.now() / 80);
  ctx.save();
  ctx.strokeStyle = hexToRgba(HAULER_TETHER_COLOR, pulse);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(screenX, screenY);
  ctx.lineTo(latch.x, latch.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(latch.x, latch.y, 7, 0, Math.PI * 2);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();
}

/** Ability rings only. Kit hulls come from the v2 outline bake. */
function drawAbilityFx(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  screenX: number,
  screenY: number,
  shipR: number,
  cameraShipPosition: { x: number; y: number }
): void {
  if (ship.shieldTimer > 0) {
    const pulse = 0.45 + 0.25 * Math.sin(Date.now() / 90);
    ctx.beginPath();
    ctx.arc(screenX, screenY, shipR + 10, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(PALETTE.HUD, pulse);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (ship.abilityActiveFrames > 0 && ship.harpoonTimer <= 0 && ship.shieldTimer <= 0) {
    ctx.beginPath();
    ctx.arc(screenX, screenY, shipR + 6, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(TITLE.ACCENT, 0.45);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  drawHaulerHarpoonVfx(ctx, ship, screenX, screenY, cameraShipPosition);
}

function drawShipImpactFlash(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  screenX: number,
  screenY: number,
  shipR: number
): void {
  if (ship.impactFlashFrames <= 0) {
    return;
  }

  const t = 1 - ship.impactFlashFrames / SHIP.IMPACT_FLASH_FRAMES;
  ctx.save();
  ctx.strokeStyle = hexToRgba(PALETTE.DANGER, 1 - t * 0.7);
  ctx.lineWidth = 1;
  ctx.shadowColor = PALETTE.DANGER;
  ctx.shadowBlur = VISUAL.SHIP_GLOW;
  ctx.beginPath();
  ctx.arc(screenX, screenY, shipR * (1.15 + t * 0.35), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFloatingHealthCapsule(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  screenX: number,
  screenY: number,
  shipR: number
): void {
  const damaged = ship.health < ship.maxHealth;
  if (!damaged && ship.impactFlashFrames <= 0 && !isDebugMode()) {
    return;
  }

  const barWidth = shipR * 2.4;
  const barY = screenY - shipR - 10;
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
