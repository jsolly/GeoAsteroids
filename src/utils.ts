/**
 *
 * @param x1 - First x
 * @param y1 - First y
 * @param x2 - Second x
 * @param y2 - Second y
 * @returns The distance between two points in pixels
 */
function distBetweenPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export { distBetweenPoints };
