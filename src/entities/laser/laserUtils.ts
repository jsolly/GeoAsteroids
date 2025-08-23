import { LASER_SPEED } from '../../constants/entities/laser';
import { FPS } from '../../constants/physics';
import { addVectors } from '../../utils/mathUtils';
import type { Velocity } from '../player/types';
import type { Ship } from '../ship/Ship';
import { Laser } from './Laser';

export function calculateLaserStartPosition(
  shipPosition: { x: number; y: number },
  shipAngle: number,
  shipRadius: number
): { x: number; y: number } {
  return {
    x: shipPosition.x + (4 / 3) * shipRadius * Math.cos(shipAngle),
    y: shipPosition.y - (4 / 3) * shipRadius * Math.sin(shipAngle),
  };
}

export function generateLaserVelocity(shipAngle: number, shipVelocity: Velocity): Velocity {
  const baseVelocity: Velocity = {
    x: (Math.cos(shipAngle) * LASER_SPEED) / FPS,
    y: (-Math.sin(shipAngle) * LASER_SPEED) / FPS,
  };
  return addVectors(baseVelocity, shipVelocity);
}

export function createLaser(ship: Ship): Laser {
  const laserStartPosition = calculateLaserStartPosition(ship.position, ship.angle, ship.r);
  const laserVelocity = generateLaserVelocity(ship.angle, ship.velocity);

  return new Laser(laserStartPosition, laserVelocity, 0, 0, false);
}
