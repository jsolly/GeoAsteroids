import type { Position, Velocity } from '../../../shared-types';

/** Asteroid (or later loot) the Hauler harpoon can latch. */
export interface HarpoonFieldBody {
  id: string;
  position: Position;
  velocity: Velocity;
}

let field: readonly HarpoonFieldBody[] = [];

/** Client belt snapshot for local latch + tether VFX. Server uses its own list. */
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
