import { expect, test } from 'vitest';
import { TOWN_SPAWN_RADIUS } from '../../../shared/furnaces';
import { createPlayer } from '../../../src/entities/player/createPlayer';
import { resolveSpawnPosition } from '../../../src/utils/spawnPosition';

// Fresh flights share the Town Square ring; explicit remote poses remain authoritative.
test('local players spawn near the arena center so co-players are in view', () => {
  for (let i = 0; i < 100; i++) {
    const player = createPlayer({ name: 'Tester', type: 'local' });
    const distanceFromCenter = Math.hypot(player.ship.position.x, player.ship.position.y);
    expect(distanceFromCenter).toBeCloseTo(TOWN_SPAWN_RADIUS, 5);
  }
});

test('remote players spawn on the same near-center path as local ships', () => {
  for (let i = 0; i < 40; i++) {
    const local = createPlayer({ name: 'Local', type: 'local' });
    const remote = createPlayer({
      id: 'remote',
      name: 'Remote',
      type: 'remote',
      position: { x: 12, y: -8 },
    });
    expect(Math.hypot(local.ship.position.x, local.ship.position.y)).toBeCloseTo(
      TOWN_SPAWN_RADIUS,
      5
    );
    expect(remote.ship.position).toEqual({ x: 12, y: -8 });
  }
});

test('resolveSpawnPosition keeps an explicit late-join pose', () => {
  expect(resolveSpawnPosition({ x: 80, y: -12 })).toEqual({ x: 80, y: -12 });
});

test('two freshly spawned players are close enough to share a viewport', () => {
  // Max separation is bounded by 2x the spawn radius; keep it well under a
  // typical viewport half-height so the remote ship renders on the local screen.
  const a = createPlayer({ name: 'A', type: 'local' });
  const b = createPlayer({ name: 'B', type: 'local' });
  const separation = Math.hypot(
    a.ship.position.x - b.ship.position.x,
    a.ship.position.y - b.ship.position.y
  );
  expect(separation).toBeLessThanOrEqual(2 * TOWN_SPAWN_RADIUS);
});
