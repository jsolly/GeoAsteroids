import type { Position } from '../shared-types';
import { findWorldBoundaryImpact } from './boundary';
import { findCourtImpact } from './ricochetCourt';

/** Fixed, non-amplifying laser surfaces shared by prediction and authority. */
export function findLaserSurfaceImpact(start: Position, end: Position) {
  const court = findCourtImpact(start, end);
  const wall = findWorldBoundaryImpact(start, end);
  return court && (!wall || court.distance <= wall.distance) ? court : wall;
}
