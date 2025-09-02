import { SHIP } from '../../constants';
import { Point } from '../../physics/Point';
import { canvasManager } from '../../rendering/canvas';
import { logger } from '../../utils/Logger';

import type { Ship } from './Ship';

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
  const nose = {
    x: centerX + radius * Math.cos(angle), // Pointed nose
    y: centerY - radius * Math.sin(angle),
  };
  const rearLeft = {
    x: centerX - radius * 0.8 * Math.cos(angle) + radius * 0.5 * Math.sin(angle), // Wider back
    y: centerY + radius * 0.8 * Math.sin(angle) + radius * 0.5 * Math.cos(angle),
  };
  const rearRight = {
    x: centerX - radius * 0.8 * Math.cos(angle) - radius * 0.5 * Math.sin(angle), // Wider back
    y: centerY + radius * 0.8 * Math.sin(angle) - radius * 0.5 * Math.cos(angle),
  };

  return { nose, rearLeft, rearRight };
}

// Helper function to create complementary colors that work well with the laser color
function createComplementaryColor(
  baseColor: string,
  lightnessAdjustment: number,
  saturationAdjustment: number
): string {
  // Parse HSL color or convert hex to HSL
  let hue: number, saturation: number, lightness: number;

  if (baseColor.startsWith('hsl')) {
    // Parse HSL color like "hsl(120, 50%, 60%)"
    const matches = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (matches) {
      hue = parseInt(matches[1], 10);
      saturation = parseInt(matches[2], 10);
      lightness = parseInt(matches[3], 10);
    } else {
      // Fallback to red if parsing fails
      hue = 0;
      saturation = 100;
      lightness = 50;
    }
  } else if (baseColor.startsWith('#')) {
    // Convert hex to HSL
    const hex = baseColor.slice(1).trim();

    // Validate hex color format
    if (hex.length !== 6 && hex.length !== 3) {
      logger.warn('RENDERING', `Invalid hex color format, using fallback: ${baseColor}`);
      hue = 0;
      saturation = 100;
      lightness = 50;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // Handle 3-character hex shorthand
    const normalizedHex =
      hex.length === 3
        ? hex
            .split('')
            .map((char) => char + char)
            .join('')
        : hex;

    const r = parseInt(normalizedHex.substr(0, 2), 16) / 255;
    const g = parseInt(normalizedHex.substr(2, 2), 16) / 255;
    const b = parseInt(normalizedHex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    // Calculate HSL
    lightness = (max + min) / 2;

    if (diff === 0) {
      hue = saturation = 0;
    } else {
      saturation = lightness > 0.5 ? diff / (2 - max - min) : diff / (max + min);

      switch (max) {
        case r:
          hue = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          hue = ((b - r) / diff + 2) / 6;
          break;
        case b:
          hue = ((r - g) / diff + 4) / 6;
          break;
        default:
          hue = 0;
      }
    }
  } else {
    // Fallback to red if color format is not recognized
    logger.warn('RENDERING', `Unrecognized color format, using fallback: ${baseColor}`);
    hue = 0;
    saturation = 100;
    lightness = 50;
  }

  // Apply adjustments
  hue = (hue * 360 + 180) % 360; // Shift hue by 180 degrees for complementary color
  saturation = Math.max(0, Math.min(100, saturation * 100 + saturationAdjustment));
  lightness = Math.max(0, Math.min(100, lightness * 100 + lightnessAdjustment));

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Helper function to draw a targeting line extending from the ship
export function drawTargetingLine(
  centerX: number,
  centerY: number,
  angle: number,
  shipRadius: number,
  lineLength: number = 300,
  color: string = '#ffffff',
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

export function drawGenericThruster(x: number, y: number, angle: number, radius: number): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  // Calculate the rear center position for the thruster
  // This should be behind the ship relative to its current orientation
  const rearCenter = {
    x: x - radius * Math.cos(angle),
    y: y + radius * Math.sin(angle),
  };

  // Create a much larger, more visible thruster flame
  const flameLength = radius * 1.5; // Make flame 1.5x ship radius
  const flameWidth = radius * 0.8; // Make flame width 0.8x ship radius

  // Calculate flame tip position (extending behind the ship)
  const flameTip = {
    x: rearCenter.x - Math.cos(angle) * flameLength,
    y: rearCenter.y + Math.sin(angle) * flameLength,
  };

  // Create a radial gradient for a more realistic flame effect
  const gradient = ctx.createRadialGradient(
    rearCenter.x,
    rearCenter.y,
    0,
    flameTip.x,
    flameTip.y,
    flameLength
  );

  // Default enhanced thruster (same for all ships)
  gradient.addColorStop(0, '#ffffff'); // White hot center
  gradient.addColorStop(0.2, '#ffff00'); // Bright yellow
  gradient.addColorStop(0.5, '#ffaa00'); // Orange
  gradient.addColorStop(0.8, '#ff6600'); // Dark orange
  gradient.addColorStop(1, '#cc3300'); // Dark red edge

  // Draw the main flame body
  ctx.fillStyle = gradient;
  ctx.beginPath();

  // Create a flame shape that extends behind the ship
  // The flame should be perpendicular to the ship's orientation
  const leftFlame = {
    x: rearCenter.x + (Math.cos(angle + Math.PI / 2) * flameWidth) / 2,
    y: rearCenter.y - (Math.sin(angle + Math.PI / 2) * flameWidth) / 2,
  };

  const rightFlame = {
    x: rearCenter.x + (Math.cos(angle - Math.PI / 2) * flameWidth) / 2,
    y: rearCenter.y - (Math.sin(angle - Math.PI / 2) * flameWidth) / 2,
  };

  // Draw flame from ship rear to tip
  ctx.moveTo(leftFlame.x, leftFlame.y);
  ctx.lineTo(flameTip.x, flameTip.y);
  ctx.lineTo(rightFlame.x, rightFlame.y);
  ctx.closePath();
  ctx.fill();

  // Add a bright center core for extra visibility
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(rearCenter.x, rearCenter.y, radius * 0.3, 0, Math.PI * 2, false);
  ctx.fill();

  // Add some particle effects for extra visual appeal
  for (let i = 0; i < 3; i++) {
    const particleDistance = Math.random() * flameLength * 0.7;
    const particleAngle = angle + (Math.random() - 0.5) * 0.3;
    const particleX = rearCenter.x - Math.cos(particleAngle) * particleDistance;
    const particleY = rearCenter.y + Math.sin(particleAngle) * particleDistance;

    ctx.fillStyle = `rgba(255, 255, 0, ${0.8 - particleDistance / flameLength})`;
    ctx.beginPath();
    ctx.arc(particleX, particleY, 2, 0, Math.PI * 2, false);
    ctx.fill();
  }
}

export function drawThruster(ship: Ship): void {
  const cvs = canvasManager.getCanvas();
  if (!cvs) {
    return;
  }

  logger.debug('THRUSTER', 'drawThruster called', {
    exploding: ship.exploding,
    blinkOn: ship.blinkOn,
    thrusting: ship.thrusting,
  });

  if (!ship.exploding && ship.blinkOn) {
    // Ship is always drawn at screen center (viewport transformation)
    const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

    logger.debug('THRUSTER', 'Drawing thruster at screen center', {
      x: screenCenter.x,
      y: screenCenter.y,
      angle: ship.angle,
      radius: ship.r,
    });

    // Use the generic thruster function
    drawGenericThruster(screenCenter.x, screenCenter.y, ship.angle, ship.r);
  } else {
    logger.debug('THRUSTER', 'Thruster not drawn - conditions not met', {
      exploding: ship.exploding,
      blinkOn: ship.blinkOn,
    });
  }
}

export function drawThrusterAtPosition(ship: Ship, shipPosition: { x: number; y: number }): void {
  const cvs = canvasManager.getCanvas();
  if (!cvs) {
    return;
  }

  if (!ship.exploding && ship.blinkOn) {
    // Convert world coordinates to screen coordinates (same as drawShipAtPosition)
    const screenX = ship.position.x - shipPosition.x + cvs.width / 2;
    const screenY = ship.position.y - shipPosition.y + cvs.height / 2;

    // Use the generic thruster function at the calculated screen position
    drawGenericThruster(screenX, screenY, ship.angle, ship.r);
  }
}

// Helper function to draw player name under ship
export function drawPlayerName(
  name: string,
  x: number,
  y: number,
  shipRadius: number,
  color: string = '#ffffff'
): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  // Position name below the ship
  const nameY = y + shipRadius + 20;

  // Set text style
  ctx.fillStyle = color;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Add a subtle background for better readability
  const textMetrics = ctx.measureText(name);
  const textWidth = textMetrics.width;
  const textHeight = 14; // Approximate height for 12px font
  const padding = 4;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(
    x - textWidth / 2 - padding,
    nameY - padding,
    textWidth + padding * 2,
    textHeight + padding * 2
  );

  // Draw the name text
  ctx.fillStyle = color;
  ctx.fillText(name, x, nameY);
}

export function drawShipExplosion(ship: Ship, color?: string): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  // Ship explosion is always drawn at screen center (viewport transformation)
  const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

  // Create explosion colors that complement the laser color
  const baseColor = color || '#ff0000'; // Default to red if no color provided

  // Generate complementary explosion colors that work well with the laser
  const darkColor = createComplementaryColor(baseColor, -0.3, 0.1); // Darker complementary outer ring
  const mediumColor = createComplementaryColor(baseColor, -0.1, 0.2); // Medium complementary ring
  const lightColor = createComplementaryColor(baseColor, 0.1, 0.3); // Lighter complementary inner ring
  const brightColor = createComplementaryColor(baseColor, 0.3, 0.4); // Bright complementary center

  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.7, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = mediumColor;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.4, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.1, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 0.8, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = brightColor;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 0.5, 0, Math.PI * 2, false);
  ctx.fill();
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

  // Convert world coordinates to screen coordinates (same as drawShipAtPosition)
  const screenX = ship.position.x - shipPosition.x + cvs.width / 2;
  const screenY = ship.position.y - shipPosition.y + cvs.height / 2;

  // Create explosion colors that complement the laser color
  const baseColor = color || ship.color || '#ff0000'; // Default to ship color or red

  // Generate complementary explosion colors that work well with the laser
  const darkColor = createComplementaryColor(baseColor, -0.3, 0.1); // Darker complementary outer ring
  const mediumColor = createComplementaryColor(baseColor, -0.1, 0.2); // Medium complementary ring
  const lightColor = createComplementaryColor(baseColor, 0.1, 0.3); // Lighter complementary inner ring
  const brightColor = createComplementaryColor(baseColor, 0.3, 0.4); // Bright complementary center

  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r * 1.7, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = mediumColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r * 1.4, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r * 1.1, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r * 0.8, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = brightColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r * 0.5, 0, Math.PI * 2, false);
  ctx.fill();
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

  for (const laser of ship.lasers) {
    // Convert laser world position to screen position using viewport transformation
    const referencePos = viewerShipPosition || ship.position;
    const screenPos = canvasManager.worldToScreen(laser.position, referencePos);

    if (laser.explodeTime === 0) {
      ctx.fillStyle = color || 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP.SIZE / 3, 0, Math.PI * 2, false);
      ctx.fill();
    } else {
      // draw explosion
      ctx.fillStyle = 'orangered';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP.SIZE / 2, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = color || 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP.SIZE / 3, 0, Math.PI * 2, false);
      ctx.fill();
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

  // Use ship's own color or provided color
  const shipColor = color || ship.color;

  // Use the shared ship triangle calculation function for consistency
  const { nose, rearLeft, rearRight } = calculateShipTrianglePoints(
    screenX,
    screenY,
    ship.r,
    ship.angle
  );

  // Draw ship body (triangle)
  ctx.strokeStyle = shipColor;
  ctx.lineWidth = SHIP.SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(rearLeft.x, rearLeft.y);
  ctx.lineTo(rearRight.x, rearRight.y);
  ctx.closePath();
  ctx.stroke();

  // Draw health bar above ship (same as local)
  const barWidth = ship.r * 2.5;
  const barHeight = 6;
  const barY = screenY - ship.r - 15;
  const healthPercent = ship.health / ship.maxHealth;
  const currentWidth = barWidth * healthPercent;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);

  let healthColor: string;
  if (healthPercent > 0.6) {
    healthColor = '#00ff00';
  } else if (healthPercent > 0.3) {
    healthColor = '#ffff00';
  } else {
    healthColor = '#ff0000';
  }
  ctx.fillStyle = healthColor;
  ctx.fillRect(screenX - barWidth / 2, barY, currentWidth, barHeight);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenX - barWidth / 2, barY, barWidth, barHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(ship.health)}/${ship.maxHealth}`, screenX, barY - 12);

  // Draw player name under ship if provided
  if (playerName) {
    drawPlayerName(playerName, screenX, screenY, ship.r, shipColor);
  }
}

// Helper function to draw player health bar in the HUD
export function drawPlayerHealthBar(health: number, maxHealth: number): void {
  const ctx = canvasManager.getContext();
  const canvas = canvasManager.getCanvas();
  if (!ctx || !canvas) {
    return;
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
