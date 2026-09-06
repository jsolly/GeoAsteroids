import { expect, test } from 'vitest';
import { Player } from '../../../src/entities/player/Player';
import { canDrawHaulerHarpoon } from '../../../src/entities/ship/shipRenderer';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';

test('local Hauler adopts a server ship latch so the tether can draw', () => {
  const local = new Player({
    id: 'alice',
    name: 'Alice',
    type: 'local',
    input: new MockPlayerInput(),
    kitId: 'hauler',
  });
  expect(canDrawHaulerHarpoon(local.ship)).toBe(false);

  local.updateFromServer({ harpoonTimer: 80, harpoonTargetId: 'bob' });

  expect(local.ship.harpoonTimer).toBe(80);
  expect(local.ship.harpoonTargetId).toBe('bob');
  expect(canDrawHaulerHarpoon(local.ship)).toBe(true);
});

test('remote Hauler matches the same server latch', () => {
  const remote = new Player({
    id: 'alice',
    name: 'Alice',
    type: 'remote',
    input: new MockPlayerInput(),
    kitId: 'hauler',
  });

  remote.updateFromServer({ harpoonTimer: 80, harpoonTargetId: 'bob' });
  expect(remote.ship.harpoonTimer).toBe(80);
  expect(remote.ship.harpoonTargetId).toBe('bob');
  expect(canDrawHaulerHarpoon(remote.ship)).toBe(true);

  remote.updateFromServer({ harpoonTimer: 0, harpoonTargetId: '' });
  expect(remote.ship.harpoonTimer).toBe(0);
  expect(remote.ship.harpoonTargetId).toBeUndefined();
  expect(canDrawHaulerHarpoon(remote.ship)).toBe(false);
});
