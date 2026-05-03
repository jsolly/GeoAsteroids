/**
 * Unified input interface for all player types
 * Human players implement via keyboard, bots via AI, remote players via network state
 */
export interface PlayerInput {
  getThrusting(): boolean;
  getAngularVelocity(): number;
  getShooting(): boolean;
  getEmpPulse(): boolean;
}

/**
 * Human player input implementation using keyboard state
 */
export class HumanPlayerInput implements PlayerInput {
  private keys: Set<string>;

  constructor(keys: Set<string>) {
    this.keys = keys;
  }

  getThrusting(): boolean {
    return this.keys.has('Space') || this.keys.has('ArrowUp');
  }

  getAngularVelocity(): number {
    let angularVelocity = 0;
    if (this.keys.has('ArrowLeft')) {
      angularVelocity += 0.1; // Rotate left
    }
    if (this.keys.has('ArrowRight')) {
      angularVelocity -= 0.1; // Rotate right
    }
    return angularVelocity;
  }

  getShooting(): boolean {
    return this.keys.has('Space'); // Space bar for shooting
  }

  getEmpPulse(): boolean {
    return this.keys.has('KeyE'); // E key for EMP pulse
  }
}

/**
 * Bot player input implementation using AI logic
 */
export class BotPlayerInput implements PlayerInput {
  private aiState: {
    targetAngle?: number;
    shouldThrust: boolean;
    shouldShoot: boolean;
    shouldEmp: boolean;
  };

  constructor(aiState: {
    targetAngle?: number;
    shouldThrust: boolean;
    shouldShoot: boolean;
    shouldEmp: boolean;
  }) {
    this.aiState = aiState;
  }

  getThrusting(): boolean {
    return this.aiState.shouldThrust;
  }

  getAngularVelocity(): number {
    if (!this.aiState.targetAngle) {
      return 0;
    }

    // For bots, we'll need to pass the current angle from the ship
    // This is a simplified version - in practice, the bot would need access to current angle
    return 0.1; // Default angular velocity for bots
  }

  getShooting(): boolean {
    return this.aiState.shouldShoot;
  }

  getEmpPulse(): boolean {
    return this.aiState.shouldEmp;
  }
}

/**
 * Remote player input implementation using network state
 */
export class RemotePlayerInput implements PlayerInput {
  private networkState: {
    thrusting: boolean;
    angularVelocity: number;
    shooting: boolean;
    empPulse: boolean;
  };

  constructor(networkState: {
    thrusting: boolean;
    angularVelocity: number;
    shooting: boolean;
    empPulse: boolean;
  }) {
    this.networkState = networkState;
  }

  getThrusting(): boolean {
    return this.networkState.thrusting;
  }

  getAngularVelocity(): number {
    return this.networkState.angularVelocity;
  }

  getShooting(): boolean {
    return this.networkState.shooting;
  }

  getEmpPulse(): boolean {
    return this.networkState.empPulse;
  }
}
