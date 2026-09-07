import { ROID } from '../../constants';

/** Large / collab-split class. Shared by client scoring and the server window. */
export function isBiggestAsteroid(size: number): boolean {
  return size >= ROID.COLLAB_SPLIT_MIN_SIZE;
}

export function pointsForRoidSize(size: number): number {
  if (isBiggestAsteroid(size)) {
    return ROID.POINTS_LARGE;
  }
  if (size >= 20) {
    return ROID.POINTS_MEDIUM;
  }
  return ROID.POINTS_SMALL;
}
