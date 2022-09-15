import { SAVE_KEY_HIGH_SCORE } from './config.js';

/**
 *
 * @param x1 - First x
 * @param y1 - First y
 * @param x2 - Second x
 * @param y2 - Second y
 * @returns The distance between two points in pixels
 */

class Point {
  constructor(readonly x: number, readonly y: number) {}

  movePoint(x: number, y: number): Point {
    return new Point(x, y);
  }

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
 * @returns - The current high score.
 */
function getHighScore(): number {
  const highScore = localStorage.getItem(SAVE_KEY_HIGH_SCORE);
  if (highScore == null) {
    localStorage.setItem(SAVE_KEY_HIGH_SCORE, '0'); // set to 0 if null
    return 0;
  }
  return Number(localStorage.getItem(SAVE_KEY_HIGH_SCORE));
}

function updateHighScore(currScore: number): void {
  const highScore = getHighScore();
  if (currScore > highScore) {
    localStorage.setItem(SAVE_KEY_HIGH_SCORE, String(currScore));
  }
}

export { Point, getHighScore, updateHighScore };
