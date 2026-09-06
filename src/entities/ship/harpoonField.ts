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
let fieldScale = 1;
const lastKnown = new Map<string, HarpoonFieldBody>();

/** Playfield snapshot for local latch + tether VFX. Server uses its own lists. */
export function publishHarpoonField(bodies: readonly HarpoonFieldBody[], playfieldScale = 1): void {
  field = bodies;
  if (Number.isFinite(playfieldScale) && playfieldScale > 0) {
    fieldScale = playfieldScale;
  }
  for (const body of bodies) {
    lastKnown.set(body.id, body);
  }
}

export function getHarpoonField(): readonly HarpoonFieldBody[] {
  return field;
}

export function getHarpoonFieldScale(): number {
  return fieldScale;
}

function idsMatch(left: string, right: string): boolean {
  return left === right || left.endsWith(right) || right.endsWith(left);
}

export function findHarpoonFieldBody(id: string | undefined): HarpoonFieldBody | undefined {
  if (!id) {
    return undefined;
  }
  const exact = field.find((body) => body.id === id);
  if (exact) {
    return exact;
  }
  const loose = field.find((body) => idsMatch(body.id, id));
  if (loose) {
    return loose;
  }
  for (const [knownId, body] of lastKnown) {
    if (idsMatch(knownId, id)) {
      return body;
    }
  }
  return undefined;
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
