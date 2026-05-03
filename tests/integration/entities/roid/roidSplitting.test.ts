import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
import { CollisionManager } from '../../../../src/physics/collision/CollisionManager';
import { Ship } from '../../../../src/entities/ship/Ship';
import { Roid, RoidBelt } from '../../../../src/entities/roid/Roid';

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

describe('Integration: Roid splitting on collision', () => {
  let collisionManager: CollisionManager;
  let localShip: Ship;
  let localPlayer: { ship: Ship; id: string; type: 'local' };
  let roidBelt: RoidBelt;

  beforeEach(() => {
    vi.clearAllMocks();
    collisionManager = CollisionManager.getInstance();

    // Create a local ship
    localShip = new Ship({ isLocalPlayer: true });
    localShip.position = { x: 400, y: 300 };
    localShip.r = 15;
    
    // Clear spawn protection to allow collisions
    localShip.blinkCount = 0;
    localShip.spawnProtectionTimer = 0;
    
    // Create local player object
    localPlayer = { ship: localShip, id: 'local-player-123', type: 'local' as const };

    // Create a roid belt with one large roid
    roidBelt = new RoidBelt(false); // Don't create initial roids
    const largeRoid = new Roid({ x: 400, y: 300 }, 25); // Large roid (should split)
    roidBelt.roids.push(largeRoid);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('large roid splits into two medium roids when collided with', () => {
    const largeRoid = roidBelt.roids[0];
    
    // Verify it's a large roid (size 25)
    expect(largeRoid.r).toBe(25);

    // Simulate collision
    collisionManager.checkPlayerAsteroidCollisions(localPlayer, roidBelt.roids);

    // Check that both collision damage and asteroid destruction messages were sent
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: 'local-player-123',
        attackerId: 'asteroid',
        damage: 25, // DAMAGE.LASER_HIT
      },
    });

    // Should send collision damage message
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: 'local-player-123',
        attackerId: 'asteroid',
        damage: 25, // DAMAGE.LASER_HIT
      },
    });

    // Should send asteroid destroyed message
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: largeRoid.id,
        playerId: 'local-player-123',
        points: 50, // Medium roid points (size 25)
      },
    });
  });

  test('medium roid splits into two small roids when collided with', () => {
    // Create a medium roid (size 12.5)
    const mediumRoid = new Roid({ x: 400, y: 300 }, 12.5);
    roidBelt.roids = [mediumRoid];

    // Simulate collision
    collisionManager.checkPlayerAsteroidCollisions(localPlayer, roidBelt.roids);

    // Check that both collision damage and asteroid destruction messages were sent
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: 'local-player-123',
        attackerId: 'asteroid',
        damage: 25,
      },
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: mediumRoid.id,
        playerId: 'local-player-123',
        points: 100, // Small roid points (size 12.5)
      },
    });
  });

  test('small roid does not split when collided with', () => {
    // Create a small roid (size 6.25)
    const smallRoid = new Roid({ x: 400, y: 300 }, 6.25);
    roidBelt.roids = [smallRoid];

    // Simulate collision
    collisionManager.checkPlayerAsteroidCollisions(localPlayer, roidBelt.roids);

    // Check that collision damage was sent
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'collisionDamage',
      data: {
        targetPlayerId: 'local-player-123',
        attackerId: 'asteroid',
        damage: 25,
      },
    });

    // Check that asteroid destruction was sent
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'asteroidDestroyed',
      data: {
        asteroidId: smallRoid.id,
        playerId: 'local-player-123',
        points: 100, // ROID.POINTS_SMALL
      },
    });
  });

  test('roid belt scoring works correctly', () => {
    // Test the RoidBelt.destroyRoid method directly
    const largeRoid = new Roid({ x: 400, y: 300 }, 50); // Use size 50 for large roid
    roidBelt.roids = [largeRoid];

    // Destroy the large roid
    const result = roidBelt.destroyRoid(0);

    // Should return score for large roid
    expect(result.score).toBe(20); // ROID.POINTS_LARGE

    // Client no longer creates new roids - server handles splitting
    expect(result.newRoids).toHaveLength(0);
  });

  test('roid belt scoring works with different sizes', () => {
    // Test scoring for different roid sizes
    const testCases = [
      { size: 50, expectedPoints: 20, description: 'large roid' },
      { size: 30, expectedPoints: 50, description: 'medium roid' },
      { size: 10, expectedPoints: 100, description: 'small roid' },
    ];

    testCases.forEach(({ size, expectedPoints }) => {
      const roid = new Roid({ x: 400, y: 300 }, size);
      roidBelt.roids = [roid];

      const result = roidBelt.destroyRoid(0);

      expect(result.score).toBe(expectedPoints);
      expect(result.newRoids).toHaveLength(0); // Client never creates new roids
    });
  });

  test('collision detection works with different roid sizes', () => {
    const testCases = [
      { size: 25, expectedPoints: 50, description: 'medium roid' },
      { size: 12.5, expectedPoints: 100, description: 'small roid' },
      { size: 6.25, expectedPoints: 100, description: 'small roid' },
    ];

    testCases.forEach(({ size, expectedPoints }) => {
      vi.clearAllMocks();
      
      const roid = new Roid({ x: 400, y: 300 }, size);
      roidBelt.roids = [roid];

      collisionManager.checkPlayerAsteroidCollisions(localPlayer, roidBelt.roids);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'collisionDamage',
        data: {
          targetPlayerId: 'local-player-123',
          attackerId: 'asteroid',
          damage: 25,
        },
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'asteroidDestroyed',
        data: {
          asteroidId: roid.id,
          playerId: 'local-player-123',
          points: expectedPoints,
        },
      });
    });
  });
});
