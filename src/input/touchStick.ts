import { TOUCH } from '../constants';

export type StickSample = {
  heading: number;
  magnitude: number;
  thrusting: boolean;
  aim: boolean;
  knobX: number;
  knobY: number;
};

/**
 * Map a pointer on the left stick to Asteroids heading + thrust.
 * Heading uses the same convention as mouse aim: 0 = +x, positive CCW.
 */
export function readStickSample(
  clientX: number,
  clientY: number,
  originX: number,
  originY: number,
  maxRadius: number = TOUCH.STICK_RADIUS,
  deadzone: number = TOUCH.STICK_DEADZONE,
  thrustAt: number = TOUCH.STICK_THRUST
): StickSample {
  const dx = clientX - originX;
  const dy = clientY - originY;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, maxRadius);
  const magnitude = maxRadius > 0 ? clamped / maxRadius : 0;
  const scale = dist > 0 ? clamped / dist : 0;

  return {
    heading: Math.atan2(-dy, dx),
    magnitude,
    thrusting: magnitude >= thrustAt,
    aim: magnitude >= deadzone,
    knobX: dx * scale,
    knobY: dy * scale,
  };
}
