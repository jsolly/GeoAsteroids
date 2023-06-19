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

export { Point };
