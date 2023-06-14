import { SAVE_KEY_PERSONAL_BEST } from './config.js';
class Point {
  constructor(readonly x: number, readonly y: number) {}

  /**
   * Returns the euclidian distance from the Point instance to another Point instance.
   */
  distToPoint(targetPoint: Point): number {
    return Math.floor(
      Math.sqrt(
        Math.pow(this.x - targetPoint.x, 2) +
          Math.pow(this.y - targetPoint.y, 2),
      ),
    );
  }
}

/**
 *
 * @returns - The current personal best score from local storage.
 */
function getPersonalBest(): number {
  const personalBest = localStorage.getItem(SAVE_KEY_PERSONAL_BEST);
  if (personalBest == null) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '0'); // set to 0 if null
    return 0;
  }
  return Number(localStorage.getItem(SAVE_KEY_PERSONAL_BEST));
}

function updatePersonalBest(currScore: number): void {
  const personalBest = getPersonalBest();
  if (currScore > personalBest) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, String(currScore));
  }
}

export { Point, getPersonalBest, updatePersonalBest };
