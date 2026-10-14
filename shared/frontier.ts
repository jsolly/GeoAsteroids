import type { Position } from '../shared-types';
import { COOPERATIVE } from './cooperativeRules';

const CELL = 5000;
const FRONTIER_ID = /^frontier:(-?\d+),(-?\d+)$/u;
/** Stable coordinates never depend on visited sectors or player count. */
export function frontierSite(id: string) {
  const match = FRONTIER_ID.exec(id);
  if (!match) {
    return undefined;
  }
  const x = Number(match[1]),
    y = Number(match[2]);
  if (
    id !== `frontier:${x},${y}` ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    Math.abs(x) > 12 ||
    Math.abs(y) > 12
  ) {
    return undefined;
  }
  const position = { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 };
  const distance = Math.hypot(position.x, position.y);
  if (distance < COOPERATIVE.initialInnerRadius || distance > COOPERATIVE.expandedOuterRadius) {
    return undefined;
  }
  return {
    id,
    name: `Frontier ${x},${y}`,
    position,
    radius: 85,
    frontier:
      distance <= COOPERATIVE.initialOuterRadius ? ('initial' as const) : ('expanded' as const),
  };
}
export function frontierSitesNear(position: Position, radius: number) {
  const sites: NonNullable<ReturnType<typeof frontierSite>>[] = [];
  for (
    let x = Math.floor((position.x - radius) / CELL);
    x <= Math.floor((position.x + radius) / CELL);
    x++
  ) {
    for (
      let y = Math.floor((position.y - radius) / CELL);
      y <= Math.floor((position.y + radius) / CELL);
      y++
    ) {
      const site = frontierSite(`frontier:${x},${y}`);
      if (
        site &&
        Math.hypot(site.position.x - position.x, site.position.y - position.y) <= radius
      ) {
        sites.push(site);
      }
    }
  }
  return sites;
}
export function sacPosition(position: Position, index: number, count: number): Position {
  const radius = count === 2 ? COOPERATIVE.sacSpacing / 2 : COOPERATIVE.sacSpacing / Math.sqrt(3);
  const angle = (index * Math.PI * 2) / count;
  return { x: position.x + Math.cos(angle) * radius, y: position.y + Math.sin(angle) * radius };
}
