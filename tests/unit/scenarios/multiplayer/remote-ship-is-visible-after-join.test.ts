import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GameServerWorld, type Pilot, useQuietServerConsole } from '../support/gameServerWorld';

useQuietServerConsole();

describe('A remote ship is visible after join', () => {
  let world: GameServerWorld;
  let alice: Pilot;

  beforeEach(() => {
    world = new GameServerWorld();
    alice = world.join('Alice', { x: -40, y: 0 });
    alice.socket.clear();
  });

  afterEach(() => {
    world.dispose();
  });

  test('the first pilot decodes the second ship in its next snapshot', () => {
    const bob = world.join('Bob', { x: 40, y: 0 });

    const ids = world.snapshot(alice).entities.map((entity) => entity.id);
    expect(ids).toEqual(expect.arrayContaining([alice.id, bob.id]));
  });
});
