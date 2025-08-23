import { SHIP_SIZE } from '../../constants/entities/ship';
import { Point } from '../../physics/Point';
import { canvasManager } from '../../rendering/canvas';

import type { Ship } from './Ship';

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
      console.warn('Invalid hex color format, using fallback:', baseColor);
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

    hue = Math.round(hue * 360);
    saturation = Math.round(saturation * 100);
    lightness = Math.round(lightness * 100);
  } else {
    // Fallback for unknown color format
    hue = 0;
    saturation = 100;
    lightness = 50;
  }

  // Create a complementary color by shifting hue by 180 degrees
  const complementaryHue = (hue + 180) % 360;

  // Adjust saturation and lightness for better visual harmony
  const adjustedSaturation = Math.max(0, Math.min(100, saturation + saturationAdjustment * 100));
  const adjustedLightness = Math.max(0, Math.min(100, lightness + lightnessAdjustment * 100));

  return `hsl(${complementaryHue}, ${adjustedSaturation}%, ${adjustedLightness}%)`;
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

  if (!ship.exploding && ship.blinkOn) {
    // Ship is always drawn at screen center (viewport transformation)
    const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

    // Use the generic thruster function
    drawGenericThruster(screenCenter.x, screenCenter.y, ship.angle, ship.r);
  }
}

export function drawShipRelative(ship: Ship): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx || !cvs) {
    return;
  }

  // Ship is always drawn at screen center (viewport transformation)
  const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

  const { angle } = ship;
  const nose = {
    x: screenCenter.x + (4 / 3) * ship.r * Math.cos(angle),
    y: screenCenter.y - (4 / 3) * ship.r * Math.sin(angle),
  };
  const rearLeft = {
    x: screenCenter.x - ship.r * ((2 / 3) * Math.cos(angle) + Math.sin(angle)),
    y: screenCenter.y + ship.r * ((2 / 3) * Math.sin(angle) - Math.cos(angle)),
  };
  const rearRight = {
    x: screenCenter.x - ship.r * ((2 / 3) * Math.cos(angle) - Math.sin(angle)),
    y: screenCenter.y + ship.r * ((2 / 3) * Math.sin(angle) + Math.cos(angle)),
  };

  ctx.strokeStyle = ship.color;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(rearLeft.x, rearLeft.y);
  ctx.lineTo(rearRight.x, rearRight.y);
  ctx.closePath();
  ctx.stroke();

  // Draw center dot to show ship orientation
  ctx.fillStyle = ship.color;
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r / 6, 0, Math.PI * 2, false);
  ctx.fill();

  // Draw health bar above ship
  const barWidth = ship.r * 2.5;
  const barHeight = 6;
  const barY = screenCenter.y - ship.r - 15;

  // Health percentage
  const healthPercent = ship.health / ship.maxHealth;
  const currentWidth = barWidth * healthPercent;

  // Background (empty health bar)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(screenCenter.x - barWidth / 2, barY, barWidth, barHeight);

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
  ctx.fillRect(screenCenter.x - barWidth / 2, barY, currentWidth, barHeight);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenCenter.x - barWidth / 2, barY, barWidth, barHeight);

  // Health text
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(ship.health)}/${ship.maxHealth}`, screenCenter.x, barY - 12);
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

export function drawLasers(ship: Ship, color?: string): void {
  const ctx = canvasManager.getContext();
  if (!ctx) {
    return;
  }

  for (const laser of ship.lasers) {
    // Convert laser world position to screen position using viewport transformation
    const screenPos = canvasManager.worldToScreen(laser.position, ship.position);

    if (laser.explodeTime === 0) {
      ctx.fillStyle = color || 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP_SIZE / 3, 0, Math.PI * 2, false);
      ctx.fill();
    } else {
      // draw explosion
      ctx.fillStyle = 'orangered';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP_SIZE / 2, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = color || 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP_SIZE / 3, 0, Math.PI * 2, false);
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
  color?: string
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

  // Compute triangle points using the same geometry as drawShipRelative
  const angle = ship.angle;
  const nose = {
    x: screenX + (4 / 3) * ship.r * Math.cos(angle),
    y: screenY - (4 / 3) * ship.r * Math.sin(angle),
  };
  const rearLeft = {
    x: screenX - ship.r * ((2 / 3) * Math.cos(angle) + Math.sin(angle)),
    y: screenY + ship.r * ((2 / 3) * Math.sin(angle) - Math.cos(angle)),
  };
  const rearRight = {
    x: screenX - ship.r * ((2 / 3) * Math.cos(angle) - Math.sin(angle)),
    y: screenY + ship.r * ((2 / 3) * Math.sin(angle) + Math.cos(angle)),
  };

  // Draw ship body (triangle)
  ctx.strokeStyle = shipColor;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(rearLeft.x, rearLeft.y);
  ctx.lineTo(rearRight.x, rearRight.y);
  ctx.closePath();
  ctx.stroke();

  // Draw center dot
  ctx.fillStyle = shipColor;
  ctx.beginPath();
  ctx.arc(screenX, screenY, ship.r / 6, 0, Math.PI * 2, false);
  ctx.fill();

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
