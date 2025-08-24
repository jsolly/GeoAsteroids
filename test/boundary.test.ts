import { describe, expect, it } from 'vitest';
import type { Ship } from '../src/entities/ship/Ship';
import { getGameBoundary } from '../src/physics/boundary';
import {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
  getBoundaryCollisionSide,
  isShipOutOfBounds,
} from '../src/physics/collision/boundaryCollisions';
import { getRandomPositionWithinBoundary } from '../src/utils/positionUtils';

describe('Boundary System', () => {
  it('should create a circular boundary with correct values', () => {
    const boundary = getGameBoundary();
    expect(boundary.cx).toBe(0);
    expect(boundary.cy).toBe(0);
    expect(boundary.radius).toBe(3100); // 3000 + 100 buffer (3x larger)
  });

  it('should detect ship out of bounds when beyond radius (left)', () => {
    const shipPosition = { x: -3200, y: 0 };
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship out of bounds when beyond radius (right)', () => {
    const shipPosition = { x: 3200, y: 0 };
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship out of bounds when beyond radius (top)', () => {
    const shipPosition = { x: 0, y: -3200 };
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship out of bounds when beyond radius (bottom)', () => {
    const shipPosition = { x: 0, y: 3200 };
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship within bounds', () => {
    const shipPosition = { x: 0, y: 0 }; // Center of boundary
    expect(isShipOutOfBounds(shipPosition)).toBe(false);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship near boundary edge but still in bounds', () => {
    const shipPosition = { x: 2900, y: 0 };
    expect(isShipOutOfBounds(shipPosition)).toBe(false);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should detect ship at boundary edge as out of bounds', () => {
    const shipPosition = { x: 3100, y: 0 };
    expect(isShipOutOfBounds(shipPosition)).toBe(true);
    expect(getBoundaryCollisionSide(shipPosition)).toBe(null);
  });

  it('should provide consistent circular boundary for mini-map rendering', () => {
    const boundary = getGameBoundary();
    expect(boundary.cx).toBe(0);
    expect(boundary.cy).toBe(0);
    expect(boundary.radius).toBeGreaterThan(0);
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
      bot.ship.position = { x: -3200, y: 0 };

      // Remove spawn protection so the bot can be affected by boundary collisions
      bot.spawnProtectedUntil = Date.now() - 1000; // Set to 1 second ago
      bot.ship.blinkCount = 0; // Remove ship invincibility

      // Create an array with the bot
      const bots = [bot];

      // Capture original position BEFORE boundary collision detection
      const originalPosition = { ...bot.ship.position };

      // Call the boundary collision detection
      detectPlayerBoundaryCollisions(bots);

      // Verify the bot is marked for explosion
      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.health).toBe(0);

      // Verify respawn timer is set
      expect(bot.respawnTimer).toBeDefined();

      // Simulate the respawn process to verify the unified respawn system works
      bot.respawn();

      // Verify the bot respawned at a different, safe position within the boundary
      const boundary = getGameBoundary();
      const shipRadius = 15; // SHIP_SIZE / 2
      const dx = bot.ship.position.x - boundary.cx;
      const dy = bot.ship.position.y - boundary.cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // getRandomPositionWithinBoundary already accounts for ship radius, so we just check distance
      expect(distance).toBeLessThanOrEqual(boundary.radius - shipRadius);

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
  const dx = position.x - boundary.cx;
  const dy = position.y - boundary.cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // getRandomPositionWithinBoundary already accounts for ship radius, so we just check distance
  expect(distance).toBeLessThanOrEqual(boundary.radius - shipRadius);
});

it('should generate different positions', () => {
  const position1 = getRandomPositionWithinBoundary();
  const position2 = getRandomPositionWithinBoundary();

  // It's possible but very unlikely for two random positions to be identical
  // If they are identical, it suggests the random generation isn't working
  const positionsAreDifferent = position1.x !== position2.x || position1.y !== position2.y;
  expect(positionsAreDifferent).toBe(true);
});
