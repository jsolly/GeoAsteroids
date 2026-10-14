import type { AsteroidData } from '../shared-types';
import { stepAsteroidMotionInto } from './asteroidMotion';
import { contourLockSpeed, contourLockVelocity } from './contourLock';

export const CONTOUR_ASTEROID_SPEED = 0.7;
/** The client predicts the same bounded curved step; snapshots remain authoritative. */
export function stepContourAsteroid(
  rock: Pick<AsteroidData, 'position' | 'velocity'> & {
    contourRider?: AsteroidData['contourRider'];
    boost?: AsteroidData['boost'];
  }
): boolean {
  if (!rock.contourRider || rock.boost?.phase === 'burning') {
    return false;
  }
  const velocity = contourLockVelocity(
    rock.position,
    rock.contourRider,
    CONTOUR_ASTEROID_SPEED / contourLockSpeed(1)
  );
  if (!velocity) {
    rock.contourRider = null;
    return false;
  }
  rock.velocity = velocity;
  const nextX = rock.position.x + velocity.x;
  const nextY = rock.position.y + velocity.y;
  stepAsteroidMotionInto(rock.position, velocity, 1, rock.position, rock.velocity);
  if (Math.abs(rock.position.x - nextX) + Math.abs(rock.position.y - nextY) > 1e-8) {
    rock.contourRider = null;
  }
  return true;
}
