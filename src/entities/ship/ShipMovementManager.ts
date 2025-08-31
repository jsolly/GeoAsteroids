import type { Position, Velocity } from '../../../shared-types';
import { GAME, SHIP } from '../../constants';
import { addPositionAndVelocity, addVectors, multiplyVelocity } from '../../utils/mathUtils';

export interface ShipMovementState {
  position: Position;
  velocity: Velocity;
  angle: number;
  angularVelocity: number;
  thrusting: boolean;
  thrusterActive: boolean;
  isBot: boolean;
}

/**
 * Apply velocity to the ship and update position
 */
export function applyVelocity(state: ShipMovementState): void {
  if (state.thrusting) {
    const thrust: Velocity = {
      x: (Math.cos(state.angle) * SHIP.THRUST) / GAME.FPS,
      y: (-Math.sin(state.angle) * SHIP.THRUST) / GAME.FPS,
    };
    state.velocity = addVectors(state.velocity, thrust);

    // Cap velocity to prevent excessive speed
    const currentSpeed = Math.sqrt(
      state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y
    );
    if (currentSpeed > SHIP.MAX_VELOCITY) {
      const scale = SHIP.MAX_VELOCITY / currentSpeed;
      state.velocity.x *= scale;
      state.velocity.y *= scale;
    }

    state.thrusterActive = true;
    // Note: drawThruster would need to be called from the Ship class since it has rendering context
  } else {
    // Use bot-specific friction if this is a bot ship
    const frictionCoeff = state.isBot ? SHIP.BOT_FRICTION : GAME.FRICTION;
    state.velocity = multiplyVelocity(state.velocity, 1 - frictionCoeff / GAME.FPS);
    state.thrusterActive = false;
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
