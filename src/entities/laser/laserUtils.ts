import { GAME, LASER } from '../../../shared/constants/gameplay';
import type { Velocity } from '../../../shared-types';
import { addVectors } from '../../utils/mathUtils';
import type { Ship } from '../ship/Ship';
import { calculateLaserStartPosition } from '../ship/shipUtils';
import { Laser } from './Laser';

export function createLaser(ship: Ship): Laser {
  const angle = ship.angle;
  const laserStartPosition = calculateLaserStartPosition(ship.position, angle, ship.r);
  const shipVelocity = ship.velocity;
  const baseVelocity: Velocity = {
    x: (Math.cos(angle) * LASER.SPEED) / GAME.FPS,
    y: (-Math.sin(angle) * LASER.SPEED) / GAME.FPS,
  };
  const laserVelocity = addVectors(baseVelocity, shipVelocity);

  return new Laser(laserStartPosition, laserVelocity, 0, 0, false);
}
