/** Floored Euclidean distance — same rounding as Point.distance (gameplay-preserving). */
export function flooredDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.floor(Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2));
}

export class Point {
  constructor(
    readonly x: number,
    readonly y: number
  ) {}

  distance(targetPoint: Point): number {
    return flooredDistance(this.x, this.y, targetPoint.x, targetPoint.y);
  }
}
