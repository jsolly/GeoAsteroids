import { expect, test } from 'vitest';
import { GameEngine } from '../../../server/core/GameEngine';

test('disconnecting one of two humans does not clear or pause the shared field', () => {
  const engine = new GameEngine(3);
  engine.createAsteroids(10);
  engine.addPlayer('peer-a', 'PeerA', {} as never);
  engine.addPlayer('peer-b', 'PeerB', {} as never);

  const idsBefore = engine.getAllAsteroids().map((asteroid) => asteroid.id).sort();
  expect(idsBefore.length).toBeGreaterThan(0);
  expect(engine.isGamePaused()).toBe(false);

  engine.removePlayer('peer-b');

  expect(engine.isGamePaused()).toBe(false);
  expect(engine.getPlayerCount()).toBe(1);
  expect(engine.getAllAsteroids().map((asteroid) => asteroid.id).sort()).toEqual(idsBefore);

  engine.removePlayer('peer-a');
  expect(engine.isGamePaused()).toBe(true);
  expect(engine.getAsteroidCount()).toBe(0);
});
