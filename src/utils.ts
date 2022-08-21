/**
 *
 * @param x1 - First x
 * @param y1 - First y
 * @param x2 - Second x
 * @param y2 - Second y
 * @returns The distance between two points in pixels
 */

class Point {
  constructor(public x: number, public y: number) {}
}

function distBetweenPoints(point1: Point, point2: Point): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2),
  );
}

export { distBetweenPoints, Point };
