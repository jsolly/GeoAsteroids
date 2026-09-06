import { expect, test } from 'vitest';
import { SPAWN } from '../../../src/constants';
import { entityFactory } from '../../../src/entities/EntityFactory';

// Regression test for the live-multiplayer bug where two players joining the
// same server could never see each other: players used to spawn anywhere inside
// the ~3100px arena radius, so they landed thousands of px apart — permanently
// off each other's viewport even though the leaderboard listed everyone.
//
// The default spawn now clusters players near the arena center (world origin)
// so co-players appear within view. Assumes the near-center/near-boundary DEBUG
// placement flags are off (their default), which is the shipped behavior.
test('local players spawn near the arena center so co-players are in view', () => {
  for (let i = 0; i < 100; i++) {
    const player = entityFactory.createLocalPlayer('Tester');
    const distanceFromCenter = Math.hypot(player.ship.position.x, player.ship.position.y);
    expect(distanceFromCenter).toBeLessThanOrEqual(SPAWN.NEAR_CENTER_RADIUS);
  }
});

test('two freshly spawned players are close enough to share a viewport', () => {
  // Max separation is bounded by 2x the spawn radius; keep it well under a
  // typical viewport half-height so the remote ship renders on the local screen.
  const a = entityFactory.createLocalPlayer('A');
  const b = entityFactory.createLocalPlayer('B');
  const separation = Math.hypot(
    a.ship.position.x - b.ship.position.x,
    a.ship.position.y - b.ship.position.y
  );
  expect(separation).toBeLessThanOrEqual(2 * SPAWN.NEAR_CENTER_RADIUS);
});
