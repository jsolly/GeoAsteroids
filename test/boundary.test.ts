import { describe, expect, it } from 'vitest';
import type { Ship } from '../src/entities/ship/Ship';
import { getGameBoundary } from '../src/physics/boundary';
import {
  getBoundaryCollisionSide,
  isShipOutOfBounds,
} from '../src/physics/collision/boundaryCollisions';
import {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
} from '../src/rendering/boundaryRenderer';
import { getRandomPositionWithinBoundary } from '../src/utils/positionUtils';

describe('Boundary System', () => {
  it('should create a boundary with correct dimensions', () => {
    const boundary = getGameBoundary();

    expect(boundary.x).toBe(-1100); // -1000 - 100 buffer
    expect(boundary.y).toBe(-1100); // -1000 - 100 buffer
    expect(boundary.width).toBe(2200); // 2000 + 200 buffer
    expect(boundary.height).toBe(2200); // 2000 + 200 buffer
  });

  it('should detect ship out of bounds on left side', () => {
    const shipPosition = { x: -1200, y: 0 }; // Left of boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe('left');
  });

  it('should detect ship out of bounds on right side', () => {
    const shipPosition = { x: 1200, y: 0 }; // Right of boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe('right');
  });

  it('should detect ship out of bounds on top side', () => {
    const shipPosition = { x: 0, y: -1200 }; // Above boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe('top');
  });

  it('should detect ship out of bounds on bottom side', () => {
    const shipPosition = { x: 0, y: 1200 }; // Below boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe('bottom');
  });

  it('should detect ship within bounds', () => {
    const shipPosition = { x: 0, y: 0 }; // Center of boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(false);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship near boundary edge but still in bounds', () => {
    const shipPosition = { x: 950, y: 0 }; // Near right edge but within bounds (considering ship radius)
    expect(isShipOutOfBounds(shipPosition)).toBe(false);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship at boundary edge as out of bounds', () => {
    const shipPosition = { x: 1100, y: 0 }; // At right edge (considering ship radius: 1100 + 15 = 1115)
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe('right');
  });

  it('should provide consistent boundary for mini-map rendering', () => {
    const boundary = getGameBoundary();

    // Verify boundary is consistent for mini-map calculations
    expect(boundary.width).toBe(boundary.height); // Should be square for rectangular mini-map representation
    expect(boundary.x).toBe(-boundary.width / 2); // Should be centered at origin
    expect(boundary.y).toBe(-boundary.height / 2); // Should be centered at origin
  });

  describe('Boundary Collision Functions', () => {
    it('should export boundary collision functions without errors', () => {
      // Test that the functions exist and can be called
      expect(typeof detectBoundaryCollisions).toBe('function');
      expect(typeof detectPlayerBoundaryCollisions).toBe('function');

      // Test that they don't throw with empty inputs
      expect(() =>
        detectBoundaryCollisions({
          position: { x: 0, y: 0 },
          r: 15,
        } as unknown as Ship)
      ).not.toThrow();
      expect(() => detectPlayerBoundaryCollisions([])).not.toThrow();
    });

    it('should set random respawn positions for bots hitting boundary', async () => {
      // Import Player to create a test bot
      const { Player } = await import('../src/entities/player/Player');

      // Create a mock bot
      const bot = new Player({ id: 'test-bot', name: 'TestBot', type: 'bot' });

      // Position bot outside the boundary
      bot.ship.position = { x: -1200, y: 0 };

      // Remove spawn protection so the bot can be affected by boundary collisions
      bot.spawnProtectedUntil = Date.now() - 1000; // Set to 1 second ago
      bot.ship.blinkCount = 0; // Remove ship invincibility

      // Create an array with the bot
      const bots = [bot];

      // Call the boundary collision detection
      detectPlayerBoundaryCollisions(bots);

      // Verify the bot is marked for explosion
      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.health).toBe(0);

      // Verify respawn timer is set
      expect(bot.respawnTimer).toBeDefined();

      // Simulate the respawn process to verify the unified respawn system works
      const originalPosition = { ...bot.ship.position };
      bot.respawn();

      // Verify the bot respawned at a different, safe position within the boundary
      const boundary = getGameBoundary();
      const shipRadius = 15; // SHIP_SIZE / 2
      expect(bot.ship.position.x - shipRadius).toBeGreaterThanOrEqual(boundary.x);
      expect(bot.ship.position.x + shipRadius).toBeLessThanOrEqual(boundary.x + boundary.width);
      expect(bot.ship.position.y - shipRadius).toBeGreaterThanOrEqual(boundary.y);
      expect(bot.ship.position.y + shipRadius).toBeLessThanOrEqual(boundary.y + boundary.height);

      // Verify it's a different position (very unlikely to be the same)
      const positionChanged =
        bot.ship.position.x !== originalPosition.x || bot.ship.position.y !== originalPosition.y;
      expect(positionChanged).toBe(true);
    });
  });
});

it('should generate positions within boundary', () => {
  const position = getRandomPositionWithinBoundary();
  const boundary = getGameBoundary();
  const shipRadius = 15; // Assuming SHIP_SIZE is 30, so radius is 15

  // Check that the ship's entire radius fits within the boundary
  expect(position.x - shipRadius).toBeGreaterThanOrEqual(boundary.x);
  expect(position.x + shipRadius).toBeLessThanOrEqual(boundary.x + boundary.width);
  expect(position.y - shipRadius).toBeGreaterThanOrEqual(boundary.y);
  expect(position.y + shipRadius).toBeLessThanOrEqual(boundary.y + boundary.height);
});

it('should generate different positions', () => {
  const position1 = getRandomPositionWithinBoundary();
  const position2 = getRandomPositionWithinBoundary();

  // It's possible but very unlikely for two random positions to be identical
  // If they are identical, it suggests the random generation isn't working
  const positionsAreDifferent = position1.x !== position2.x || position1.y !== position2.y;
  expect(positionsAreDifferent).toBe(true);
});
