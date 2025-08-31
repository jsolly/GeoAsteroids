import type { Velocity } from '../../../shared-types';
import { GAME, LASER } from '../../constants';
import { addVectors } from '../../utils/mathUtils';
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
    x: (Math.cos(shipAngle) * LASER.SPEED) / GAME.FPS,
    y: (-Math.sin(shipAngle) * LASER.SPEED) / GAME.FPS,
  };
  return addVectors(baseVelocity, shipVelocity);
}

export function createLaser(ship: Ship): Laser {
  const laserStartPosition = calculateLaserStartPosition(ship.position, ship.angle, ship.r);
  const laserVelocity = generateLaserVelocity(ship.angle, ship.velocity);

  return new Laser(laserStartPosition, laserVelocity, 0, 0, false);
}
