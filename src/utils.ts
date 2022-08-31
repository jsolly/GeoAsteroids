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
    return Math.sqrt(
      Math.pow(this.x - targetPoint.x, 2) + Math.pow(this.y - targetPoint.y, 2),
    );
  }
}

export { Point };
