import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ROID } from '../../../../src/constants';
import {
  GameServerWorld,
  useQuietServerConsole,
  type Pilot,
} from '../support/gameServerWorld';

useQuietServerConsole();

describe('A roid break is visible to both pilots', () => {
  let world: GameServerWorld;
  let alice: Pilot;
  let bob: Pilot;

  beforeEach(() => {
    world = new GameServerWorld();
    alice = world.join('Alice');
    bob = world.join('Bob');
  });

  afterEach(() => {
    world.dispose();
  });

  test('destroying a roid notifies every connected socket', () => {
    const [roid] = world.engine.createAsteroids(1);
    expect(roid).toBeTruthy();

    alice.socket.clear();
    bob.socket.clear();
    world.send(alice, {
      type: 'asteroidDestroyed',
      data: { asteroidId: roid!.id, playerId: alice.id, points: ROID.POINTS_LARGE },
    });

    for (const socket of [alice.socket, bob.socket]) {
      expect(socket.lastReceived('asteroidDestroy')?.data).toMatchObject({
        asteroidId: roid!.id,
      });
    }
    expect(world.engine.getAsteroid(roid!.id)).toBeUndefined();
  });
});
