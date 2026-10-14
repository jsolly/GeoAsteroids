import type { RolyPolyState } from '../../../shared-types';

let animals: readonly RolyPolyState[] = [];
export function setRolyPolys(rows: readonly RolyPolyState[] = []): void {
  animals = rows;
}
export function getRolyPolys(): readonly RolyPolyState[] {
  return animals;
}
