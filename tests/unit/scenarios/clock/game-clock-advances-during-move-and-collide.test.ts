import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DAMAGE, SHIP } from '../../../../src/constants';
import {
  GameServerWorld,
  useQuietServerConsole,
  type Pilot,
} from '../support/gameServerWorld';

useQuietServerConsole();

describe('The game clock keeps ticking', () => {
  let world: GameServerWorld;
  let ace: Pilot;

  beforeEach(() => {
    vi.useFakeTimers();
    world = new GameServerWorld();
    ace = world.join('Ace');
    world.wearOffJoinInvulnerability();
  });

  afterEach(() => {
    world.dispose();
    vi.useRealTimers();
  });

  test('gameTime advances while a ship moves and collides — it is not a static tick', () => {
    const timeBefore = world.gameTime();
    expect(timeBefore).toBeGreaterThan(0);

    world.startClock();
    world.move(ace, { x: 120, y: 40 });
    world.hitAsteroid(ace);

    vi.advanceTimersByTime(1000);

    const timeAfter = world.gameTime();
    expect(timeAfter).toBeGreaterThan(timeBefore);
    expect(timeAfter - timeBefore).toBeGreaterThanOrEqual(50);
    expect(timeAfter - timeBefore).toBeLessThanOrEqual(80);
    expect(world.entity(ace).position).toEqual({ x: 120, y: 40 });
    expect(world.entity(ace).health).toBe(SHIP.MAX_HEALTH - DAMAGE.LASER_HIT);
  });
});
