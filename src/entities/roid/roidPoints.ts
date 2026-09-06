import { ROID } from '../../constants';

/** Points awarded for destroying an asteroid, keyed by radius. */
export function getAsteroidPoints(radius: number): number {
  if (radius >= ROID.LARGE_RADIUS) {
    return ROID.POINTS_LARGE;
  }
  if (radius >= ROID.MEDIUM_RADIUS) {
    return ROID.POINTS_MEDIUM;
  }
  return ROID.POINTS_SMALL;
}
