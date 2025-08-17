export class Point {
  constructor(
    readonly x: number,
    readonly y: number
  ) {}

  distance(targetPoint: Point): number {
    return Math.floor(Math.sqrt((this.x - targetPoint.x) ** 2 + (this.y - targetPoint.y) ** 2));
  }
}
