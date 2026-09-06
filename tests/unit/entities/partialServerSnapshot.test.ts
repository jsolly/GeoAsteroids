import { expect, test } from 'vitest';
import { GAME } from '../../../src/constants';
import { Player } from '../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';

function localPilot(): Player {
  return new Player({
    id: 'local',
    name: 'Local',
    type: 'local',
    input: new MockPlayerInput(),
  });
}

test('omitting spawnProtectionTimer from a snapshot does not clear it', () => {
  const player = localPilot();
  player.ship.health = 100;
  player.updateFromServer({ spawnProtectionTimer: 180, health: 100 });
  expect(player.serverSpawnProtectionTimer).toBe(180);

  player.updateFromServer({ position: { x: 10, y: 20 } });
  expect(player.serverSpawnProtectionTimer).toBe(180);
});

test('omitted lives and score do not reset the HUD', () => {
  const player = localPilot();
  player.lives = 2;
  player.score = 210;

  player.updateFromServer({ position: { x: 10, y: 20 } });

  expect(player.lives).toBe(2);
  expect(player.score).toBe(210);
});

test('a fresh 3-life / 0-score snapshot does not clobber established HUD progress', () => {
  const player = localPilot();
  player.lives = 2;
  player.score = 210;

  player.updateFromServer({ lives: GAME.START_LIVES, score: GAME.STARTING_SCORE });

  expect(player.lives).toBe(2);
  expect(player.score).toBe(210);
});

test('respawnTimer 0 does not latch the local ship as dead', () => {
  const player = localPilot();
  player.ship.health = 100;
  player.ship.exploding = false;
  const origin = { x: 40, y: 50 };
  player.ship.position = origin;

  player.updateFromServer({
    respawnTimer: 0,
    position: { x: 40, y: 50 },
    health: 100,
  });
  player.updateFromServer({
    position: { x: 400, y: 10 },
    health: 100,
  });

  expect(player.ship.position).toEqual(origin);
});
