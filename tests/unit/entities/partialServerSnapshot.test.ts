import { expect, test } from 'vitest';
import { Player } from '../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';

test('omitting spawnProtectionTimer from a lean snapshot does not clear it', () => {
  const player = new Player({
    id: 'local',
    name: 'Local',
    type: 'local',
    input: new MockPlayerInput(),
  });
  player.ship.health = 100;
  player.updateFromServer({ spawnProtectionTimer: 180, health: 100 });
  expect(player.serverSpawnProtectionTimer).toBe(180);

  player.updateFromServer({ position: { x: 10, y: 20 } });
  expect(player.serverSpawnProtectionTimer).toBe(180);
});
