import { describe, expect, test } from 'vitest';
import { SHIP } from '../../../src/constants';
import {
  isDeadOrExploding,
  resolveLocalHealthFromServer,
  shouldAcceptServerTransform,
  shouldReleaseRespawnLatch,
} from '../../../src/entities/player/playerSync';

describe('playerSync helpers', () => {
  test('isDeadOrExploding covers health, explode, and respawn timer', () => {
    expect(isDeadOrExploding(0, false, undefined)).toBe(true);
    expect(isDeadOrExploding(50, true, undefined)).toBe(true);
    expect(isDeadOrExploding(50, false, 10)).toBe(true);
    expect(isDeadOrExploding(50, false, undefined)).toBe(false);
  });

  test('shouldAcceptServerTransform is always true for remotes', () => {
    expect(shouldAcceptServerTransform(false, false)).toBe(true);
    expect(shouldAcceptServerTransform(true, false)).toBe(false);
    expect(shouldAcceptServerTransform(true, true)).toBe(true);
  });

  test('resolveLocalHealthFromServer accepts damage and rejects stale regen rewind', () => {
    const damaged = resolveLocalHealthFromServer({
      currentHealth: 80,
      serverHealth: 60,
      maxHealth: 100,
      wasDead: false,
      wasExploding: false,
      lastServerHealthEcho: 80,
    });
    expect(damaged.health).toBe(60);

    const staleEcho = resolveLocalHealthFromServer({
      currentHealth: 70,
      serverHealth: 65,
      maxHealth: 100,
      wasDead: false,
      wasExploding: false,
      lastServerHealthEcho: 60,
    });
    expect(staleEcho.health).toBe(70);
  });

  test('shouldReleaseRespawnLatch requires movement away from death', () => {
    const death = { x: 0, y: 0 };
    expect(
      shouldReleaseRespawnLatch(true, true, 100, false, undefined, { x: 10, y: 0 }, death)
    ).toBe(false);
    expect(
      shouldReleaseRespawnLatch(
        true,
        true,
        100,
        false,
        undefined,
        { x: SHIP.RESPAWN_LATCH_MIN_DISTANCE + 1, y: 0 },
        death
      )
    ).toBe(true);
  });
});
