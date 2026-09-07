import { getGameBoundary } from '../boundary';
import { type ContourLevel, extractIsoContours } from './contours';
import { createHeightfield, type Heightfield } from './heightfield';
import { TERRAIN } from './terrainConfig';

interface TerrainCache {
  field: Heightfield;
  contours: ContourLevel[];
}

let cache: TerrainCache | null = null;

function boundsFromWorld(): { cx: number; cy: number; radius: number } {
  const boundary = getGameBoundary();
  return { cx: boundary.cx, cy: boundary.cy, radius: boundary.radius };
}

export function ensureTerrain(
  seed: number = TERRAIN.DEFAULT_SEED,
  bounds = boundsFromWorld()
): Heightfield {
  if (
    cache &&
    cache.field.seed === seed &&
    cache.field.cx === bounds.cx &&
    cache.field.cy === bounds.cy &&
    cache.field.radius === bounds.radius
  ) {
    return cache.field;
  }

  const field = createHeightfield(seed, bounds);
  cache = { field, contours: extractIsoContours(field) };
  return field;
}

export function getTerrainField(): Heightfield {
  return cache?.field ?? ensureTerrain();
}

export function getTerrainContours(): ContourLevel[] {
  if (!cache) {
    ensureTerrain();
  }
  return cache?.contours ?? [];
}

export function getTerrainSeed(): number {
  return cache?.field.seed ?? TERRAIN.DEFAULT_SEED;
}

export function applyTerrainSeed(seed: number | undefined): Heightfield {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return ensureTerrain();
  }
  return ensureTerrain(seed >>> 0);
}
