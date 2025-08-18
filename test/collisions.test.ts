import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/entities/player/types.ts';
import { Laser, Ship } from '../src/entities/ship/Ship.ts';
import {
  detectLaserPlayerCollisions,
  detectPlayerLaserShipCollisions,
} from '../src/physics/collisions.ts';
import { Vector } from '../src/physics/Vector.ts';

// Mock the constants
vi.mock('../src/constants', () => ({
  DEBUG: false,
  DRAW_ASTEROIDS: true,
  LASER_EXPLODE_DUR: 0.1,
  FPS: 60,
  SHIP_INV_DUR: 3,
  SHIP_INV_BLINK_DUR: 0.1,
  BOT_LASER_DAMAGE: 15,
  SHIP_MAX_HEALTH: 100,
  SHIP_SIZE: 30,
  START_LIVES: 3,
  LASER_SPEED: 300,
  LASER_MAX: 200,
  LASER_DIST: 0.6,
  SHIP_THRUST: 5,
  FRICTION: 0.98,
  EMP_PULSE_DURATION: 0.5,
  SHIP_HEALTH_REGEN_RATE: 1,
  SHIP_HEALTH_REGEN_DELAY: 5,
  NEXT_LEVEL_POINTS: 1000,
  START_LEVEL: 1,
  STARTING_SCORE: 0,
  soundIsOn: () => true,
}));

// Mock the sound effects
vi.mock('../src/asteroids', () => ({
  Roid: {
    fxHit: {
      play: vi.fn(),
    },
  },
}));

// Mock the bot manager
vi.mock('../src/botManager', () => ({
  BotManager: {
    getInstance: vi.fn(() => ({
      getBotLasers: vi.fn(() => new Map()),
      botTakeDamage: vi.fn(),
    })),
  },
}));

// Mock the game controller
vi.mock('../src/gameController', () => ({
  GameController: {
    getInstance: vi.fn(() => ({
      getMultiplayerManager: vi.fn(() => ({
        removePlayer: vi.fn(),
      })),
    })),
  },
}));

describe('Collision Detection System', () => {
  let ship: Ship;
  let laser: Laser;
  let mockTestPlayer: Player;

  beforeEach(() => {
    // Create a test ship
    ship = new Ship();
    ship.position = new Vector(0, 0);
    ship.lasers = [];

    // Make ship vulnerable for testing (remove invincibility)
    ship.blinkCount = 0;
    ship.blinkOn = false;

    // Create a test laser
    laser = new Laser(new Vector(100, 0), new Vector(1, 0), 0, 0);
    laser.explodeTime = 0; // Not exploding

    // Create a test test player
    const mockShip = new Ship();
    mockShip.position = new Vector(100, 0); // Same position as laser
    mockShip.velocity = new Vector(0, 0);
    mockShip.r = 15; // Player radius
    mockShip.a = 0;
    mockShip.exploding = false;
    mockShip.explodeTime = 0;
    mockShip.blinkCount = 0; // No invincibility
    mockShip.spawnProtectionTimer = 0;
    mockShip.blinkOn = false;
    mockShip.health = 100;
    mockShip.maxHealth = 100;
    mockShip.lastDamageTime = 0;
    mockShip.healthRegenTimer = 0;

    mockTestPlayer = {
      id: 'test-player-1',
      name: 'TestPlayer1',
      ship: mockShip,
      score: 0,
      lastUpdate: Date.now(),
      isBot: false,
      lives: 3,
      spawnProtectedUntil: Date.now() + 3000, // 3 seconds spawn protection
      respawn: () => {},
      onShipExploded: () => {},
    };
    // Set ship-specific properties
    mockShip.lastShotTime = 0;
    mockShip.shotCooldown = 2000;

    // Add laser to ship
    ship.lasers = [laser];
  });

  describe('detectLaserPlayerCollisions', () => {
    it('should detect collision when laser hits test player', () => {
      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50); // Should award 50 points for player hit
      expect(laser.explodeTime).toBeGreaterThan(0); // Laser should explode
      expect(mockTestPlayer.ship.health).toBe(85); // Player should take 15 damage (100 - 15)
    });

    it('should not detect collision when player is exploding', () => {
      mockTestPlayer.ship.exploding = true;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0); // Laser should not explode
      expect(mockTestPlayer.ship.health).toBe(100); // Health should not change
    });

    it('should not detect collision when player is exploding', () => {
      mockTestPlayer.ship.exploding = true;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should not detect collision when player is invincible (blinking)', () => {
      mockTestPlayer.ship.blinkCount = 10;
      mockTestPlayer.ship.blinkOn = true;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should not detect collision when laser is already exploding', () => {
      laser.explodeTime = 10; // Laser is already exploding

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should handle multiple players correctly', () => {
      const mockShip2 = new Ship();
      mockShip2.position = new Vector(200, 0); // Further away
      mockShip2.velocity = new Vector(0, 0);
      mockShip2.r = 15;
      mockShip2.a = 0;
      mockShip2.exploding = false;
      mockShip2.explodeTime = 0;
      mockShip2.blinkCount = 0;
      mockShip2.spawnProtectionTimer = 0;
      mockShip2.blinkOn = false;
      mockShip2.health = 100;
      mockShip2.maxHealth = 100;
      mockShip2.lastDamageTime = 0;
      mockShip2.healthRegenTimer = 0;

      const mockTestPlayer2 = {
        ...mockTestPlayer,
        id: 'test-player-2',
        name: 'TestPlayer2',
        ship: mockShip2,
        lives: 3,
      };

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer, mockTestPlayer2]);

      expect(score).toBe(50); // Should only hit the first player
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(85);
      expect(mockTestPlayer2.ship.health).toBe(100); // Second player should not be hit
    });

    it('should handle player death when health reaches 0', () => {
      mockTestPlayer.ship.health = 10; // Low health

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(0);
      expect(mockTestPlayer.lives).toBe(2); // Should lose a life
      expect(mockTestPlayer.ship.exploding).toBe(true); // Should start exploding
    });

    it('should handle player permanent death when no lives remaining', () => {
      mockTestPlayer.ship.health = 10;
      mockTestPlayer.lives = 0; // No lives remaining

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(0);
      expect(mockTestPlayer.lives).toBe(0);
      expect(mockTestPlayer.ship.exploding).toBe(true); // Should be exploding
      expect(mockTestPlayer.ship.exploding).toBe(true);
    });

    it('should skip bot players', () => {
      mockTestPlayer.isBot = true;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should handle collision threshold correctly', () => {
      // Position laser just outside collision threshold
      laser.position = new Vector(120, 0); // 100 + 15 (player radius) + 2 (laser radius) + 3 (extra buffer) = 120
      mockTestPlayer.ship.position = new Vector(100, 0);

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0); // No collision
      expect(laser.explodeTime).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should handle collision threshold correctly when laser is inside', () => {
      // Position laser inside collision threshold
      laser.position = new Vector(110, 0); // 100 + 10 (inside player radius)
      mockTestPlayer.ship.position = new Vector(100, 0);

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50); // Should collide
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(85);
    });
  });

  describe('Test Player Invincibility System', () => {
    it('should respect blinkCount invincibility', () => {
      mockTestPlayer.ship.blinkCount = 5;
      mockTestPlayer.ship.blinkOn = true;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should allow collision when blinkCount is 0', () => {
      mockTestPlayer.ship.blinkCount = 0;
      mockTestPlayer.ship.blinkOn = false;

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(85);
    });

    it('should allow collision when blinkOn is false even if blinkCount > 0', () => {
      mockTestPlayer.ship.blinkCount = 5;
      mockTestPlayer.ship.blinkOn = false; // Not currently blinking

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(mockTestPlayer.ship.health).toBe(85);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty players array', () => {
      const score = detectLaserPlayerCollisions(ship, []);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle undefined players array', () => {
      const score = detectLaserPlayerCollisions(ship, undefined as unknown as Player[]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle ship with no lasers', () => {
      ship.lasers = [];

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(mockTestPlayer.ship.health).toBe(100);
    });

    it('should handle multiple lasers hitting same player', () => {
      const laser2 = new Laser(new Vector(100, 0), new Vector(1, 0), 0, 0);
      laser2.explodeTime = 0;

      ship.lasers = [laser, laser2];

      const score = detectLaserPlayerCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(100); // Both lasers should hit (50 + 50)
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(laser2.explodeTime).toBeGreaterThan(0); // Second laser should also hit
      expect(mockTestPlayer.ship.health).toBe(70); // 100 - 15 - 15 = 70
    });
  });

  describe('detectPlayerLaserShipCollisions', () => {
    it('should detect when test player laser hits local ship', () => {
      // Position test player close to ship
      mockTestPlayer.ship.position = new Vector(50, 0); // 50 units away from ship
      mockTestPlayer.ship.a = Math.PI; // Facing left (towards ship at 0,0)

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(50); // Should award 50 points
      expect(ship.health).toBe(initialShipHealth - 15); // Should take 15 damage
    });

    it('should not detect collision when ship is invincible', () => {
      // Make ship invincible
      ship.blinkCount = 10;
      ship.blinkOn = true;

      // Position test player close to ship
      mockTestPlayer.ship.position = new Vector(50, 0);
      mockTestPlayer.ship.a = 0;

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0); // No points awarded
      expect(ship.health).toBe(initialShipHealth); // Health should not change
    });

    it('should not detect collision when test player is exploding', () => {
      mockTestPlayer.ship.exploding = true;

      // Position test player close to ship
      mockTestPlayer.ship.position = new Vector(50, 0);
      mockTestPlayer.ship.a = 0;

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(ship.health).toBe(initialShipHealth);
    });

    it('should not detect collision when test player is exploding', () => {
      mockTestPlayer.ship.exploding = true;

      // Position test player close to ship
      mockTestPlayer.ship.position = new Vector(50, 0);
      mockTestPlayer.ship.a = 0;

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(ship.health).toBe(initialShipHealth);
    });

    it('should not detect collision when test player is invincible', () => {
      mockTestPlayer.ship.blinkCount = 5;
      mockTestPlayer.ship.blinkOn = true;

      // Position test player close to ship
      mockTestPlayer.ship.position = new Vector(50, 0);
      mockTestPlayer.ship.a = 0;

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(ship.health).toBe(initialShipHealth);
    });

    it('should not detect collision when test player is too far away', () => {
      // Position test player far from ship
      mockTestPlayer.ship.position = new Vector(200, 0);
      mockTestPlayer.ship.a = 0;

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(ship.health).toBe(initialShipHealth);
    });

    it('should not detect collision when test player is facing away from ship', () => {
      // Position test player close to ship but facing away
      mockTestPlayer.ship.position = new Vector(50, 0);
      mockTestPlayer.ship.a = 0; // Facing right (away from ship)

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer]);

      expect(score).toBe(0);
      expect(ship.health).toBe(initialShipHealth);
    });

    it('should handle multiple test players correctly', () => {
      // Position first player to face towards ship
      mockTestPlayer.ship.position = new Vector(50, 0); // 50 units away from ship
      mockTestPlayer.ship.a = Math.PI; // Facing left (towards ship at 0,0)

      const mockTestPlayer2 = {
        ...mockTestPlayer,
        id: 'test-player-2',
        name: 'TestPlayer2',
        position: new Vector(0, 50), // Above ship
        a: (3 * Math.PI) / 2, // Facing down (towards ship) - 3π/2 = 270° = facing down
      };

      const initialShipHealth = ship.health;
      const score = detectPlayerLaserShipCollisions(ship, [mockTestPlayer, mockTestPlayer2]);

      expect(score).toBe(100); // Both players should hit (50 + 50)
      expect(ship.health).toBe(initialShipHealth - 30); // Should take 30 damage (15 + 15)
    });
  });
});
