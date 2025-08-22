import { Point } from './Point';

class Vector extends Point {
  static fromAngle(angle: number): Vector {
    return new Vector(Math.cos(angle), -Math.sin(angle));
  }

  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector): Vector {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  distance(other: Vector): number {
    return super.distance(other);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) {
      return new Vector(0, 0);
    }
    return new Vector(this.x / mag, this.y / mag);
  }

  limit(max: number): Vector {
    const mag = this.magnitude();
    if (mag > max) {
      return this.normalize().multiply(max);
    }
    return new Vector(this.x, this.y);
  }

  divide(scalar: number): Vector {
    if (scalar === 0) {
      return new Vector(0, 0);
    }
    return new Vector(this.x / scalar, this.y / scalar);
  }
}

export { Vector };
