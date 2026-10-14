import { getTerrainField } from '../../shared/terrainField';
import { onTravelRoute } from '../../shared/travelRoutes';
import type { Position } from '../../shared-types';

let active = false;
let enteredAt: number | null = null;
let onChange: (() => void) | undefined;

export function registerRouteMusicListener(listener: () => void): void {
  onChange = listener;
}
export function isRouteMusicActive(): boolean {
  return active;
}

function setActive(next: boolean): void {
  if (next === active) {
    return;
  }
  active = next;
  onChange?.();
}

export function resetRouteMusic(): void {
  enteredAt = null;
  setActive(false);
}

/** A short moving dwell keeps incidental crossings from interrupting the bed. */
export function updateRouteMusic(
  ship: {
    position: Position;
    velocity: Position;
    health: number;
    exploding: boolean;
    furnaceTransit?: unknown;
    overlayHold?: boolean;
  },
  now = performance.now()
): void {
  const riding =
    ship.health > 0 &&
    !ship.exploding &&
    Boolean(ship.furnaceTransit) === false &&
    ship.overlayHold !== true &&
    Math.hypot(ship.velocity.x, ship.velocity.y) > 0.3 &&
    onTravelRoute(getTerrainField(), ship.position);
  if (!riding) {
    resetRouteMusic();
    return;
  }
  enteredAt ??= now;
  if (now - enteredAt >= 800) {
    setActive(true);
  }
}
