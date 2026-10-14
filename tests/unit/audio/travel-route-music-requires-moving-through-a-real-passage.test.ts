import { afterEach, expect, test } from 'vitest';
import { createHeightfield } from '../../../shared/heightfield';
import { ensureTerrain } from '../../../shared/terrainField';
import { nearbyRouteWaypoints, onTravelRoute } from '../../../shared/travelRoutes';
import {
  isRouteMusicActive,
  resetRouteMusic,
  updateRouteMusic,
} from '../../../src/audio/routeMusic';

afterEach(resetRouteMusic);

test('waypoints are bounded, deterministic, and sit on the actual generated passages', () => {
  const field = createHeightfield(782, { radius: 60000 });
  const position = { x: 5000, y: 5000 };
  const points = nearbyRouteWaypoints(field, position);
  expect(points.length).toBeGreaterThan(0);
  expect(points.length).toBeLessThanOrEqual(6);
  expect(points).toEqual(nearbyRouteWaypoints(field, position));
  expect(points.every((point) => onTravelRoute(field, point.position))).toBe(true);
  expect(onTravelRoute(field, { x: 0, y: 0 })).toBe(false);
});

test('music waits for a moving dwell, clears on stop/death/overlay/transit, and never plays at the starter origin', () => {
  const field = ensureTerrain();
  const position = nearbyRouteWaypoints(field, { x: 5000, y: 5000 })[0]?.position;
  if (!position) {
    throw new Error('Missing route waypoint');
  }
  const ship = { position, velocity: { x: 1, y: 0 }, health: 100, exploding: false };
  updateRouteMusic(ship, 0);
  updateRouteMusic(ship, 799);
  expect(isRouteMusicActive()).toBe(false);
  updateRouteMusic(ship, 800);
  expect(isRouteMusicActive()).toBe(true);
  for (const condition of [
    { velocity: { x: 0, y: 0 } },
    { health: 0 },
    { exploding: true },
    { overlayHold: true },
    { furnaceTransit: {} },
    { position: { x: 0, y: 0 } },
  ]) {
    updateRouteMusic({ ...ship, ...condition }, 900);
    expect(isRouteMusicActive()).toBe(false);
    updateRouteMusic(ship, 1000);
    updateRouteMusic(ship, 2000);
    expect(isRouteMusicActive()).toBe(true);
  }
});
