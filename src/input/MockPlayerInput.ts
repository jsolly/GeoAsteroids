import type { PlayerInput } from './PlayerInput';

/**
 * Mock input implementation for testing
 */
export class MockPlayerInput implements PlayerInput {
  private thrusting: boolean = false;
  private angularVelocity: number = 0;
  private shooting: boolean = false;
  private empPulse: boolean = false;

  constructor(overrides?: {
    thrusting?: boolean;
    angularVelocity?: number;
    shooting?: boolean;
    empPulse?: boolean;
  }) {
    if (overrides) {
      this.thrusting = overrides.thrusting ?? this.thrusting;
      this.angularVelocity = overrides.angularVelocity ?? this.angularVelocity;
      this.shooting = overrides.shooting ?? this.shooting;
      this.empPulse = overrides.empPulse ?? this.empPulse;
    }
  }

  getThrusting(): boolean {
    return this.thrusting;
  }

  getAngularVelocity(): number {
    return this.angularVelocity;
  }

  getShooting(): boolean {
    return this.shooting;
  }

  getEmpPulse(): boolean {
    return this.empPulse;
  }

  // Helper methods for testing
  setThrusting(thrusting: boolean): void {
    this.thrusting = thrusting;
  }

  setAngularVelocity(angularVelocity: number): void {
    this.angularVelocity = angularVelocity;
  }

  setShooting(shooting: boolean): void {
    this.shooting = shooting;
  }

  setEmpPulse(empPulse: boolean): void {
    this.empPulse = empPulse;
  }
}
