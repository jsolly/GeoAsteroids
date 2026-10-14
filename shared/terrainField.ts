import { WORLD_BOUNDARY } from './boundary';
import { createHeightfield, type Heightfield } from './heightfield';
import { TERRAIN } from './terrainConfig';

// The room's heightfield. Clients derive contour drawings from it in
// src/physics/terrain/terrainSession.ts; the server only samples it.
let field: Heightfield | null = null;

export function ensureTerrain(
  seed: number = TERRAIN.DEFAULT_SEED,
  bounds = WORLD_BOUNDARY
): Heightfield {
  if (
    field &&
    field.seed === seed &&
    field.cx === bounds.cx &&
    field.cy === bounds.cy &&
    field.radius === bounds.radius
  ) {
    return field;
  }
  field = createHeightfield(seed, bounds);
  return field;
}

export function getTerrainField(): Heightfield {
  return field ?? ensureTerrain();
}

export function getTerrainSeed(): number {
  return field?.seed ?? TERRAIN.DEFAULT_SEED;
}

export function applyTerrainSeed(seed: number): Heightfield {
  return ensureTerrain(seed >>> 0);
}
