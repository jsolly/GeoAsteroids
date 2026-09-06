import type { Position, SoftFactionId, Velocity } from '../../../shared-types';

/** Asteroid or ship the Hauler harpoon can latch. Same shape on client and server. */
export interface HarpoonFieldBody {
  id: string;
  position: Position;
  velocity: Velocity;
  kind?: 'asteroid' | 'ship';
  factionId?: SoftFactionId;
  exploding?: boolean;
  health?: number;
  shieldTimer?: number;
  shieldActive?: boolean;
}

let field: readonly HarpoonFieldBody[] = [];

/** Playfield snapshot for local latch + tether VFX. Server uses its own lists. */
export function publishHarpoonField(bodies: readonly HarpoonFieldBody[]): void {
  field = bodies;
}

export function getHarpoonField(): readonly HarpoonFieldBody[] {
  return field;
}

export function findHarpoonFieldBody(id: string | undefined): HarpoonFieldBody | undefined {
  if (!id) {
    return undefined;
  }
  return field.find((body) => body.id === id);
}

export function harpoonBodyFromShip(
  id: string,
  ship: {
    position: Position;
    velocity: Velocity;
    factionId?: SoftFactionId;
    exploding?: boolean;
    health?: number;
    shieldTimer?: number;
    shieldActive?: boolean;
  },
  factionId?: SoftFactionId
): HarpoonFieldBody {
  return {
    id,
    position: ship.position,
    velocity: ship.velocity,
    kind: 'ship',
    factionId: factionId ?? ship.factionId,
    exploding: ship.exploding,
    health: ship.health,
    shieldTimer: ship.shieldTimer,
    shieldActive: ship.shieldActive,
  };
}

export function collectPlayHarpoonField(
  rocks: readonly HarpoonFieldBody[],
  ships: readonly HarpoonFieldBody[]
): HarpoonFieldBody[] {
  return [...rocks, ...ships];
}
