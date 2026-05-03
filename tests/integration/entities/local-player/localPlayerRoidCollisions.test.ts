import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
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

  test('applies instant damage and sends messages when ship collides with asteroid', () => {
    // Note: pass a typical server/player id that does not match Ship.id
    const localPlayerId = 'local-player-123';
    const localPlayer = { ship: localShip, id: localPlayerId, type: 'local' as const };
    const initialHealth = localShip.health;

    collisionManager.checkPlayerAsteroidCollisions(localPlayer, [roid]);

    // Ship should have taken damage
    expect(localShip.health).toBeLessThan(initialHealth);

    // Should send collision damage message to server
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: localPlayerId,
        attackerId: 'asteroid',
        damage: 25, // DAMAGE.LASER_HIT value
      },
    });

    // Should send asteroid destroyed message to server
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: roid.id,
        playerId: localPlayerId,
        points: 50, // Medium asteroid points (radius 25)
      },
    });
  });
});


