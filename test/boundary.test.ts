import { describe, expect, it } from 'vitest';
import type { Ship } from '../src/entities/ship/Ship';
import {
  getBoundaryCollisionSide,
  getGameBoundary,
  isShipOutOfBounds,
} from '../src/physics/boundary';
import { detectBoundaryCollisions, detectPlayerBoundaryCollisions } from '../src/physics/collision';

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
      // Import BotPlayer to create a test bot
      const { BotPlayer } = await import('../src/entities/bot/BotPlayer');

      // Create a mock bot
      const bot = new BotPlayer({ id: 'test-bot', name: 'TestBot', botType: 'aggressive' });

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

      // Verify respawn timer and position are set
      expect(bot.respawnTimer).toBeDefined();
      expect(bot.respawnPosition).toBeDefined();

      // Verify respawn position is within the game boundary with margin
      const boundary = getGameBoundary();
      const margin = 100;
      expect(bot.respawnPosition?.x).toBeGreaterThanOrEqual(boundary.x + margin);
      expect(bot.respawnPosition?.x).toBeLessThanOrEqual(boundary.x + boundary.width - margin);
      expect(bot.respawnPosition?.y).toBeGreaterThanOrEqual(boundary.y + margin);
      expect(bot.respawnPosition?.y).toBeLessThanOrEqual(boundary.y + boundary.height - margin);
    });
  });
});
