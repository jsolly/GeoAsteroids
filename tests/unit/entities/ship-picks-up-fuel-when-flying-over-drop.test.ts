import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FUEL } from '../../../src/constants';
import { FuelDrop } from '../../../src/entities/fuel/FuelDrop';
import { Ship } from '../../../src/entities/ship/Ship';
import { CollisionManager } from '../../../src/physics/collision/CollisionManager';
import { applyFuelPickup } from '../../../shared/fuel';

const mockSendMessage = vi.fn();
const mockGetLocalPlayerId = vi.fn(() => 'local-player-123');

vi.mock('../../../src/network/networkManager', () => ({
  NetworkManager: {
    getInstance: vi.fn(() => ({
      isConnected: true,
      getLocalPlayerId: mockGetLocalPlayerId,
      sendMessage: mockSendMessage,
    })),
  },
}));

describe('ship picks up fuel when flying over a drop', () => {
  let collisionManager: CollisionManager;
  let ship: Ship;

  beforeEach(() => {
    vi.clearAllMocks();
    collisionManager = CollisionManager.getInstance();
    ship = new Ship({ position: { x: 400, y: 300 } });
    ship.fuel = 20;
    ship.maxFuel = FUEL.MAX;
    ship.exploding = false;
    ship.health = 100;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('local ship fills its tank and reports the pickup', () => {
    const drop = FuelDrop.createAt('fuel-1', { x: 400, y: 300 }, 25, 10);
    const drops = [drop];

    collisionManager.checkShipFuelPickupCollisions(
      { ship, id: 'local-player-123', type: 'local' },
      drops
    );

    expect(ship.fuel).toBe(45);
    expect(drops).toHaveLength(0);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'fuelPickup',
      data: { dropId: 'fuel-1', playerId: 'local-player-123' },
    });
  });

  test('bot ship uses the same pickup path', () => {
    const botShip = new Ship({ position: { x: 10, y: 10 }, isBot: true });
    botShip.fuel = 10;
    botShip.maxFuel = FUEL.MAX;
    const drop = FuelDrop.createAt('fuel-bot', { x: 10, y: 10 }, 25, 10);
    const drops = [drop];

    collisionManager.checkShipFuelPickupCollisions(
      { ship: botShip, id: 'server-bot-0', type: 'bot' },
      drops
    );

    expect(botShip.fuel).toBe(35);
    expect(drops).toHaveLength(0);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'fuelPickup',
      data: { dropId: 'fuel-bot', playerId: 'server-bot-0' },
    });
  });

  test('pickup caps at the shared max tank', () => {
    const tank = { fuel: 90, maxFuel: FUEL.MAX };
    expect(applyFuelPickup(tank, FUEL.DROP_AMOUNT)).toBe(FUEL.MAX);
  });

  test('a full tank leaves the drop in the world', () => {
    ship.fuel = FUEL.MAX;
    const drop = FuelDrop.createAt('fuel-full', { x: 400, y: 300 }, 25, 10);
    const drops = [drop];

    collisionManager.checkShipFuelPickupCollisions(
      { ship, id: 'local-player-123', type: 'local' },
      drops
    );

    expect(ship.fuel).toBe(FUEL.MAX);
    expect(drops).toHaveLength(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('exploding ships do not collect fuel', () => {
    ship.exploding = true;
    const drop = FuelDrop.createAt('fuel-miss', { x: 400, y: 300 }, 25, 10);
    const drops = [drop];

    collisionManager.checkShipFuelPickupCollisions(
      { ship, id: 'local-player-123', type: 'local' },
      drops
    );

    expect(ship.fuel).toBe(20);
    expect(drops).toHaveLength(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
