import { getCTX, getCVS, SHIP_SIZE } from './constants';
import { Ship } from './ship';
import { Point } from './point';
import { worldToScreen } from './utils';

/**
 * Draw a generic thruster effect at a given position and angle
 * @param x - X position (screen coordinates)
 * @param y - Y position (screen coordinates)
 * @param angle - Angle in radians
 * @param radius - Ship radius
 * @param color - Thruster color (optional, defaults to orange/red)
 */
function drawGenericThruster(
  x: number,
  y: number,
  angle: number,
  radius: number,
  color?: string,
): void {
  const ctx = getCTX();
  if (!ctx) return;

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
    flameLength,
  );

  if (color === 'blue') {
    // Blue thruster for defensive bots
    gradient.addColorStop(0, '#ffffff'); // White hot center
    gradient.addColorStop(0.2, '#66ccff'); // Bright blue
    gradient.addColorStop(0.6, '#0066ff'); // Medium blue
    gradient.addColorStop(1, '#0033cc'); // Dark blue edge
  } else if (color === 'red') {
    // Red thruster for aggressive bots
    gradient.addColorStop(0, '#ffffff'); // White hot center
    gradient.addColorStop(0.2, '#ffaa00'); // Bright orange
    gradient.addColorStop(0.6, '#ff6600'); // Medium orange
    gradient.addColorStop(1, '#cc3300'); // Dark red edge
  } else {
    // Default enhanced thruster (for player ship and patrol bots)
    gradient.addColorStop(0, '#ffffff'); // White hot center
    gradient.addColorStop(0.2, '#ffff00'); // Bright yellow
    gradient.addColorStop(0.5, '#ffaa00'); // Orange
    gradient.addColorStop(0.8, '#ff6600'); // Dark orange
    gradient.addColorStop(1, '#cc3300'); // Dark red edge
  }

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
  if (color === 'default') {
    // Only add particles to player ship thruster for performance
    for (let i = 0; i < 3; i++) {
      const particleDistance = Math.random() * flameLength * 0.7;
      const particleAngle = angle + (Math.random() - 0.5) * 0.3;
      const particleX =
        rearCenter.x - Math.cos(particleAngle) * particleDistance;
      const particleY =
        rearCenter.y + Math.sin(particleAngle) * particleDistance;

      ctx.fillStyle = `rgba(255, 255, 0, ${0.8 - particleDistance / flameLength})`;
      ctx.beginPath();
      ctx.arc(particleX, particleY, 2, 0, Math.PI * 2, false);
      ctx.fill();
    }
  }
}

/**
 * Draw the ship's thruster on the canvas
 * @param ship - The current Ship
 */
function drawThruster(ship: Ship): void {
  const cvs = getCVS();
  if (!cvs) return;

  if (!ship.exploding && ship.blinkOn) {
    // Ship is always drawn at screen center (viewport transformation)
    const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

    // Use the generic thruster function
    drawGenericThruster(screenCenter.x, screenCenter.y, ship.a, ship.r);
  }
}

/**
 * Draw the ship relative to the viewport (ship is always at screen center)
 * @param ship - The ship to draw
 */
function drawShipRelative(ship: Ship): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  // Ship is always drawn at screen center (viewport transformation)
  const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

  const { a } = ship;
  const nose = {
    x: screenCenter.x + (4 / 3) * ship.r * Math.cos(a),
    y: screenCenter.y - (4 / 3) * ship.r * Math.sin(a),
  };
  const rearLeft = {
    x: screenCenter.x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
    y: screenCenter.y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  };
  const rearRight = {
    x: screenCenter.x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
    y: screenCenter.y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  };

  ctx.strokeStyle = 'white';
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(rearLeft.x, rearLeft.y);
  ctx.lineTo(rearRight.x, rearRight.y);
  ctx.closePath();
  ctx.stroke();

  // Draw red centering dot at the actual geometric center of the ship triangle
  const triangleCenterX = (nose.x + rearLeft.x + rearRight.x) / 3;
  const triangleCenterY = (nose.y + rearLeft.y + rearRight.y) / 3;

  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(triangleCenterX, triangleCenterY, 1.5, 0, Math.PI * 2, false);
  ctx.fill();
}

/**
 * Draw the explosion when a ship is destroyed
 * @param ship - The ship that is exploding
 */
function drawShipExplosion(ship: Ship): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  // Ship explosion is always drawn at screen center (viewport transformation)
  const screenCenter = new Point(cvs.width / 2, cvs.height / 2);

  ctx.fillStyle = 'darkred';
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.7, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.4, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'Orange';
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 1.1, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'Yellow';
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 0.8, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.fillStyle = 'White';
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, ship.r * 0.5, 0, Math.PI * 2, false);
  ctx.fill();
}

function drawLasers(ship: Ship): void {
  const ctx = getCTX();
  if (!ctx) return;

  for (const laser of ship.lasers) {
    // Convert laser world position to screen position using viewport transformation
    const screenPos = worldToScreen(laser.position, ship.position);

    if (laser.explodeTime == 0) {
      ctx.fillStyle = 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, SHIP_SIZE / 15, 0, Math.PI * 2, false);
      ctx.fill();
    } else {
      // draw explosion
      ctx.fillStyle = 'orangered';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ship.r * 0.75, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.fillStyle = 'salmon';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, ship.r * 0.5, 0, Math.PI * 2, false);
      ctx.fill();
    }
  }
}

export {
  drawShipRelative,
  drawShipExplosion,
  drawThruster,
  drawLasers,
  drawGenericThruster,
};

/**
 * Draw the EMP pulse effect around the ship
 * @param ship - The current Ship
 * @param empRadius - The radius of the EMP pulse
 * @param empAlpha - The alpha/transparency of the EMP effect (0-1)
 */
function drawEmpPulse(ship: Ship, empRadius: number, empAlpha: number): void {
  const ctx = getCTX();
  const cvs = getCVS();
  if (!ctx || !cvs) return;

  const centerX = cvs.width / 2;
  const centerY = cvs.height / 2;

  // Create a radial gradient for the EMP effect
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    empRadius,
  );

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

export { drawEmpPulse };
