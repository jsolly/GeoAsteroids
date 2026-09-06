import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
import { DAMAGE } from '../../../../src/constants';
import { CollisionManager } from '../../../../src/physics/collision/CollisionManager';
import { Ship } from '../../../../src/entities/ship/Ship';
import { Roid } from '../../../../src/entities/roid/Roid';

// Mock NetworkManager for integration testing
const mockSendMessage = vi.fn();
const mockGetLocalPlayerId = vi.fn(() => 'local-player-123');

vi.mock('../../../../src/network/networkManager', () => ({
  NetworkManager: {
    getInstance: vi.fn(() => ({
      isConnected: true,
      getLocalPlayerId: mockGetLocalPlayerId,
      sendMessage: mockSendMessage,
      updatePlayerState: vi.fn(),
    })),
  },
}));

// Mock logger to keep output clean
vi.mock('../../../../src/utils/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Integration: Local player roid collisions', () => {
  let collisionManager: CollisionManager;
  let localShip: Ship;
  let roid: Roid;

  beforeEach(() => {
    vi.clearAllMocks();
    collisionManager = CollisionManager.getInstance();

    // Create a local ship with a random UUID id (default). Intentionally do NOT align with player id.
    localShip = new Ship({ isLocalPlayer: true });
    localShip.position = { x: 400, y: 300 };
    localShip.r = 15;

    // Clear spawn protection to allow collisions
    localShip.blinkCount = 0;
    localShip.spawnProtectionTimer = 0;

    // Place a roid directly overlapping the ship so collision detection triggers without mocks
    roid = new Roid({ x: 400, y: 300 }, 25);
    roid.velocity = { x: 0, y: 0 };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('roid contact explodes the ship immediately and tells the server', () => {
    const localPlayerId = 'local-player-123';
    const localPlayer = { ship: localShip, id: localPlayerId, type: 'local' as const };

    collisionManager.checkPlayerAsteroidCollisions(localPlayer, [roid]);

    expect(localShip.health).toBe(0);
    expect(localShip.exploding).toBe(true);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: localPlayerId,
        attackerId: 'asteroid',
        damage: DAMAGE.ASTEROID_COLLISION,
      },
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: roid.id,
        playerId: localPlayerId,
        points: 50,
        cause: 'collision',
      },
    });
  });
});

