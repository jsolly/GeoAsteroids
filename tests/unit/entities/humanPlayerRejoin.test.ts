import { expect, test } from 'vitest';
import { EntityManager } from '../../../server/core/EntityManager';
import { RNGService } from '../../../server/core/RNGService';

test('rejoining the same human id keeps lives and swaps the socket', () => {
  const manager = new EntityManager(new RNGService(1));
  const firstSocket = { sent: 1 } as never;
  const secondSocket = { sent: 2 } as never;
  const first = manager.addHumanPlayer('pilot-1', 'Pilot', firstSocket, { x: 8, y: 9 }, '#abc');
  first.lives = 1;
  first.health = 40;

  const rejoined = manager.addHumanPlayer('pilot-1', 'Pilot', secondSocket, { x: 0, y: 0 }, '#def');

  expect(rejoined).toBe(first);
  expect(manager.getHumanPlayerCount()).toBe(1);
  expect(rejoined.lives).toBe(1);
  expect(rejoined.health).toBe(40);
  expect(rejoined.position).toEqual({ x: 8, y: 9 });
  expect(rejoined.ws).toBe(secondSocket);
  expect(rejoined.color).toBe('#def');
});

test('rejoining after the socket was removed restores lives and score, not a fresh 3/0', () => {
  const manager = new EntityManager(new RNGService(1));
  const first = manager.addHumanPlayer('pilot-1', 'Pilot', { sent: 1 } as never, { x: 8, y: 9 });
  first.lives = 2;
  first.score = 210;

  manager.removeEntity('pilot-1');
  expect(manager.getHumanPlayerCount()).toBe(0);

  const rejoined = manager.addHumanPlayer(
    'pilot-1',
    'Pilot',
    { sent: 2 } as never,
    { x: 3000, y: 0 }
  );

  expect(rejoined.lives).toBe(2);
  expect(rejoined.score).toBe(210);
  expect(rejoined.health).toBe(100);
  expect(rejoined.spawnProtectionTimer).toBeGreaterThan(0);
});
