import type { Position, Velocity } from '../../../shared-types';
import { GAME, SHIP } from '../../constants';
import { GROWTH, maxVelocityFromMass, thrustScaleFromMass } from '../../../shared/shipGrowth';
import { applySharedShipSlope } from '../../physics/terrain/applyShipSlope';
import { addPositionAndVelocity, addVectors, multiplyVelocity } from '../../utils/mathUtils';

export interface ShipMovementState {
  position: Position;
  velocity: Velocity;
  angle: number;
  angularVelocity: number;
  thrusting: boolean;
  thrusterActive: boolean;
  frictionCoefficient: number; // Player-specific friction instead of hardcoded bot logic
  mass?: number;
}

/**
 * Apply velocity to the ship and update position
 */
export function applyVelocity(state: ShipMovementState): void {
  if (state.thrusting) {
    const mass = state.mass ?? GROWTH.BASE_MASS;
    const thrustScale = thrustScaleFromMass(mass);
    const maxVelocity = maxVelocityFromMass(mass);
    const thrust: Velocity = {
      x: (Math.cos(state.angle) * SHIP.THRUST * thrustScale) / GAME.FPS,
      y: (-Math.sin(state.angle) * SHIP.THRUST * thrustScale) / GAME.FPS,
    };
    state.velocity = addVectors(state.velocity, thrust);

    // Cap velocity to prevent excessive speed
    const currentSpeed = Math.sqrt(
      state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y
    );
    if (currentSpeed > maxVelocity) {
      const scale = maxVelocity / currentSpeed;
      state.velocity.x *= scale;
      state.velocity.y *= scale;
    }

    state.thrusterActive = true;
    // Note: drawThruster would need to be called from the Ship class since it has rendering context
  } else {
    // Use player-specific friction coefficient
    state.velocity = multiplyVelocity(state.velocity, 1 - state.frictionCoefficient / GAME.FPS);
    state.thrusterActive = false;
  }

  applySharedShipSlope(state.velocity, state.position);
  const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
  if (currentSpeed > SHIP.MAX_VELOCITY) {
    const scale = SHIP.MAX_VELOCITY / currentSpeed;
    state.velocity.x *= scale;
    state.velocity.y *= scale;
  }
}

/**
 * Move the ship based on current velocity
 */
export function move(state: ShipMovementState): void {
  state.angle += state.angularVelocity;
  applyVelocity(state);

  const newPosition = addPositionAndVelocity(state.position, state.velocity);
  state.position = newPosition;
}

/**
 * Update ship angle by angular velocity
 */
export function updateRotation(state: ShipMovementState): void {
  state.angle += state.angularVelocity;
}

/**
 * Set thrusting state and handle sound effects
 */
export function setThrusting(state: ShipMovementState, thrusting: boolean): void {
  state.thrusting = thrusting;
  if (thrusting) {
    state.thrusterActive = true;
    // Sound effects would be handled by the Ship class
  } else {
    state.thrusterActive = false;
  }
}

/**
 * Set angular velocity for rotation
 */
export function setAngularVelocity(state: ShipMovementState, angularVelocity: number): void {
  state.angularVelocity = angularVelocity;
}

/**
 * Get the current movement data for network synchronization
 */
export function getMovementData(state: ShipMovementState): {
  position: Position;
  velocity: Velocity;
  angle: number;
} {
  return {
    position: { x: state.position.x, y: state.position.y },
    velocity: { x: state.velocity.x, y: state.velocity.y },
    angle: state.angle,
  };
}

/**
 * Update movement state from network data
 */
export function updateFromNetwork(
  state: ShipMovementState,
  data: {
    position?: Position;
    velocity?: Velocity;
    angle?: number;
  }
): void {
  if (data.position) {
    state.position = data.position;
  }
  if (data.velocity) {
    state.velocity = data.velocity;
  }
  if (data.angle !== undefined) {
    state.angle = data.angle;
  }
}
