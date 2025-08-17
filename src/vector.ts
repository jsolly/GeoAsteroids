import { Point } from './point.js';

class Vector extends Point {
  /**
   * Creates a new Vector instance.
   * @param x - The x-component of the vector.
   * @param y - The y-component of the vector.
   */
  /**
   * Creates a Vector from an angle.
   * @param angle - The angle in radians.
   * @returns A new Vector instance.
   */
  static fromAngle(angle: number): Vector {
    return new Vector(Math.cos(angle), -Math.sin(angle));
  }

  /**
   * Adds a vector to this vector.
   * @param other - The vector to add.
   * @returns A new Vector instance representing the sum.
   */
  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtracts a vector from this vector.
   * @param other - The vector to subtract.
   * @returns A new Vector instance representing the difference.
   */
  subtract(other: Vector): Vector {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - The scalar to multiply by.
   * @returns A new Vector instance representing the scaled vector.
   */
  multiply(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  /**
   * Calculates the magnitude of the vector.
   * @returns The magnitude of the vector.
   */
  magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  /**
   * Calculates the distance to another vector.
   * @param other - The other vector.
   * @returns The distance between the vectors.
   */
  distance(other: Vector): number {
    return super.distance(other);
  }

  /**
   * Normalizes the vector to unit length.
   * @returns A new Vector instance with unit length.
   */
  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) return new Vector(0, 0);
    return new Vector(this.x / mag, this.y / mag);
  }

  /**
   * Limits the magnitude of the vector to a maximum value.
   * @param max - The maximum magnitude.
   * @returns A new Vector instance with limited magnitude.
   */
  limit(max: number): Vector {
    const mag = this.magnitude();
    if (mag > max) {
      return this.normalize().multiply(max);
    }
    return new Vector(this.x, this.y);
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar - The scalar to divide by.
   * @returns A new Vector instance representing the divided vector.
   */
  divide(scalar: number): Vector {
    if (scalar === 0) return new Vector(0, 0);
    return new Vector(this.x / scalar, this.y / scalar);
  }

  // Intentionally no in-place mutation helpers to preserve immutability
}

export { Vector };
