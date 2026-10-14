import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SatellitePickupData } from '../../../shared-types';
import { PlayerManager } from '../../../src/entities/player/PlayerManager';
import { SatellitePickupManager } from '../../../src/entities/satellitePickup/SatellitePickupManager';
import { NetworkManager } from '../../../src/network/networkManager';

const manager = SatellitePickupManager.getInstance();
function satellite(id: string, ownerId: string): SatellitePickupData {
  return {
    id,
    ownerId,
    name: `Satellite ${id}`,
    typeId: 'landsat-7',
    assetKey: 'eo/landsat-7',
    position: { x: 100, y: 200 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    radius: 12,
    color: '#C4B5FD',
    state: 'stored',
    health: 50,
    maxHealth: 50,
  };
}

beforeAll(() => {
  const network = NetworkManager.getInstance();
  PlayerManager.getInstance({ networkPort: network, combatNetwork: network.combatNetwork });
});
beforeEach(() => manager.clear());
afterEach(() => manager.clear());

test('equip, transfer and removal notify immediately while health changes wait for presentation sampling', () => {
  const notify = vi.fn();
  const unsubscribe = manager.subscribeInventory(notify);
  try {
    const stored = satellite('pickup', 'pilot');
    manager.syncFromServer([stored]);
    expect(notify).toHaveBeenCalledTimes(1);
    const original = manager.getOwnedPage('pilot', 0)[0];
    manager.syncFromServer([{ ...stored, health: 42 }]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(original?.health).toBe(42);
    manager.syncFromServer([{ ...stored, state: 'orbiting', health: 42 }]);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(manager.getEquipped('pilot')).toBe(original);
    manager.syncFromServer([{ ...stored, ownerId: 'other', state: 'orbiting' }]);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify.mock.lastCall?.[0]).toEqual(new Set(['pilot', 'other']));
    expect(manager.getOwnedCount('pilot')).toBe(0);
    expect(manager.getEquipped('pilot')).toBeUndefined();
    expect(manager.getEquipped('other')).toBe(original);
    manager.syncFromServer([]);
    expect(notify).toHaveBeenCalledTimes(4);
    expect(manager.getOwnedCount('other')).toBe(0);
    manager.clear();
    expect(notify).toHaveBeenCalledTimes(4);
  } finally {
    unsubscribe();
  }
  manager.syncFromServer([satellite('later', 'pilot')]);
  expect(notify).toHaveBeenCalledTimes(4);
});
