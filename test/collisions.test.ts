import { describe, expect, it, vi } from 'vitest';
import { Laser } from '../src/entities/laser/Laser';
import { Player } from '../src/entities/player/Player';
import { Ship } from '../src/entities/ship/Ship.ts';
import { detectLaserPlayerCollisions } from '../src/physics/collision/laserCollisions';

// Mock the constants
vi.mock('../src/constants', () => ({
  DEBUG: false,
  LASER_EXPLODE_DUR: 0.1,
  FPS: 60,
  SHIP_INV_DUR: 3,
  SHIP_INV_BLINK_DUR: 0.1,

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
  SHIP_EXPLODE_DUR_FRAMES: 18,
  getCVS: () => ({}),
  soundIsOn: () => true,
  SHIP_COLLISION_DAMAGE: 20,
}));

// Mock the sound effects
vi.mock('../src/entities/roid/Roid.ts', () => ({
  Roid: {
    fxHit: {
      play: vi.fn(),
    },
  },
}));

// Mock the bot manager
vi.mock('../src/entities/bot/botManager.ts', () => ({
  BotManager: {
    getInstance: vi.fn(() => ({
      getBotLasers: vi.fn(() => new Map()),
    })),
  },
}));

// Mock the game controller
vi.mock('../src/core/gameController.ts', () => ({
  GameController: {
    getInstance: vi.fn(() => ({
      getMultiplayerManager: vi.fn(() => ({
        removePlayer: vi.fn(),
      })),
    })),
  },
}));

describe('Collision Detection System', () => {
  // Helper function to create fresh test objects for each test
  function createTestObjects() {
    // Create a test ship
    const ship = new Ship();
    ship.position = { x: 0, y: 0 };
    ship.lasers = [];

    // Make ship vulnerable for testing (remove invincibility)
    ship.blinkCount = 0;
    ship.blinkOn = false;

    // Create a test laser
    const laser = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    laser.explodeTime = 0; // Not exploding

    // Create a non-bot other player with minimal mock
    const mockShip = {
      position: { x: 100, y: 0 }, // Same position as laser
      velocity: { x: 0, y: 0 },
      r: 15, // Player radius
      angle: 0,
      exploding: false,
      explodeTime: 0,
      blinkCount: 0, // No invincibility
      spawnProtectionTimer: 0,
      blinkOn: false,
      health: 100,
      maxHealth: 100,
      lastDamageTime: 0,
      healthRegenTimer: 0,
      lastShotTime: 0,
      shotCooldown: 2000,
    } as unknown as Ship;

    const otherPlayer = Player.createPlayer({
      id: 'player-1',
      name: 'Player1',
      type: 'remote',
      position: { x: 100, y: 0 },
    });
    otherPlayer.ship = mockShip;
    otherPlayer.score = 0;
    otherPlayer.lastUpdate = Date.now();
    otherPlayer.lives = 3;
    otherPlayer.spawnProtectedUntil = Date.now() + 3000; // 3 seconds spawn protection
    otherPlayer.color = '#ff0000'; // Test color for the other player

    // Add laser to ship
    ship.lasers = [laser];

    return { ship, laser, otherPlayer };
  }

  describe('detectLaserPlayerCollisions', () => {
    it('should detect collision when laser hits other player', () => {
      const { ship, laser, otherPlayer } = createTestObjects();

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(50); // Should award 50 points for player hit
      expect(laser.explodeTime).toBeGreaterThan(0); // Laser should explode
      expect(otherPlayer.ship.health).toBe(85); // Player should take 15 damage (100 - 15)
    });

    it('should not detect collision when player is exploding', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      otherPlayer.ship.exploding = true;

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0); // Laser should not explode
      expect(otherPlayer.ship.health).toBe(100); // Health should not change
    });

    it('should not detect collision when player is invincible (blinking)', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      otherPlayer.ship.blinkCount = 10;
      otherPlayer.ship.blinkOn = true;

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should not detect collision when laser is already exploding', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      laser.explodeTime = 10; // Laser is already exploding

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle multiple players correctly', () => {
      const { ship, laser, otherPlayer } = createTestObjects();

      const mockShip2 = {
        position: { x: 200, y: 0 }, // Further away
        velocity: { x: 0, y: 0 },
        r: 15,
        angle: 0,
        exploding: false,
        explodeTime: 0,
        blinkCount: 0,
        spawnProtectionTimer: 0,
        blinkOn: false,
        health: 100,
        maxHealth: 100,
        lastDamageTime: 0,
        healthRegenTimer: 0,
      } as unknown as Ship;

      const otherPlayer2 = Player.createPlayer({
        id: 'player-2',
        name: 'Player2',
        type: 'remote',
        position: { x: 200, y: 0 },
      });
      otherPlayer2.ship = mockShip2;
      otherPlayer2.lives = 3;

      const score = detectLaserPlayerCollisions(ship, [otherPlayer, otherPlayer2]);

      expect(score).toBe(50); // Should only hit the first player
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(85);
      expect(otherPlayer2.ship.health).toBe(100); // Second player should not be hit
    });

    it('should handle player death when health reaches 0', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      otherPlayer.ship.health = 10; // Low health

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(0);
      expect(otherPlayer.lives).toBe(2); // Should lose a life
      expect(otherPlayer.ship.exploding).toBe(true); // Should start exploding
    });

    it('should handle player permanent death when no lives remaining', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      otherPlayer.ship.health = 10;
      otherPlayer.lives = 0; // No lives remaining

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(50);
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(0);
      expect(otherPlayer.lives).toBe(0);
      expect(otherPlayer.ship.exploding).toBe(true); // Should be exploding
    });

    it('should handle all player types', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      // Note: In the refactored system, this function should only receive human players
      // Bot players are handled by a separate detection system

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(50); // Should hit the human player
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(85);
    });

    it('should handle collision threshold correctly', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      // Position laser just outside collision threshold
      laser.position = { x: 120, y: 0 }; // 100 + 15 (player radius) + 2 (laser radius) + 3 (extra buffer) = 120
      otherPlayer.ship.position = { x: 100, y: 0 };

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(0); // No collision
      expect(laser.explodeTime).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle collision threshold correctly when laser is inside', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      // Position laser inside collision threshold
      laser.position = { x: 110, y: 0 }; // 100 + 10 (inside player radius)
      otherPlayer.ship.position = { x: 100, y: 0 };

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(50); // Should collide
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(85);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty players array', () => {
      const { ship, laser } = createTestObjects();

      const score = detectLaserPlayerCollisions(ship, []);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle undefined players array', () => {
      const { ship, laser } = createTestObjects();

      const score = detectLaserPlayerCollisions(ship, undefined as unknown as Player[]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle ship with no lasers', () => {
      const { ship, otherPlayer } = createTestObjects();
      ship.lasers = [];

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle multiple lasers hitting same player', () => {
      const { ship, laser, otherPlayer } = createTestObjects();
      const laser2 = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
      laser2.explodeTime = 0;

      ship.lasers = [laser, laser2];

      const score = detectLaserPlayerCollisions(ship, [otherPlayer]);

      expect(score).toBe(100); // Both lasers should hit (50 + 50)
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(laser2.explodeTime).toBeGreaterThan(0); // Second laser should also hit
      expect(otherPlayer.ship.health).toBe(70); // 100 - 15 - 15 = 70
    });
  });

  // detectPlayerLaserShipCollisions tests removed (no local simulation)
});

// Mock the constants needed for bot-roid collisions
vi.mock('../src/constants', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    SHIP_COLLISION_DAMAGE: 20,
    SHIP_HEALTH_REGEN_DELAY: 5,
    SHIP_RESPAWN_DELAY_FRAMES: 300,
    SHIP_EXPLODE_DUR_FRAMES: 18,
    FPS: 60,
  };
});

// Mock the roid sound
vi.mock('../src/entities/roid/Roid.ts', () => ({
  Roid: {
    fxHit: {
      play: vi.fn(),
    },
  },
}));

describe('Bot-Roid Collision System', () => {
  it('should apply damage to bots when hitting roids', async () => {
    // Import the function after mocking
    const { detectPlayerRoidCollisions } = await import('../src/physics/collision/shipCollisions');

    // Create a mock bot with minimal required properties
    const mockBot = {
      id: 'test-bot',
      botType: 'aggressive' as const,
      ship: {
        position: { x: 0, y: 0 },
        r: 15,
        health: 100,
        maxHealth: 100,
        exploding: false,
        blinkCount: 0,
        spawnProtectedUntil: 0,
        lastDamageTime: 0,
        healthRegenTimer: 0,
        explodeTime: 0,
        takeDamage: (amount: number) => {
          mockBot.ship.health = Math.max(0, mockBot.ship.health - amount);
          mockBot.ship.lastDamageTime = 60; // FPS value
          mockBot.ship.healthRegenTimer = 300; // 5 * 60
          if (mockBot.ship.health <= 0) {
            mockBot.ship.health = 0;
            mockBot.ship.exploding = true;
            mockBot.ship.explodeTime = 18;
          }
        },
      },
      spawnProtectedUntil: 0,
    };

    // Create a mock roid belt with one roid
    const mockRoidBelt = {
      roids: [
        {
          position: { x: 10, y: 0 }, // Close enough to collide
          r: 20,
        },
      ],
    };

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      bots,
      mockRoidBelt as unknown as import('../src/entities/roid/Roid').RoidBelt
    );

    // Verify damage was applied
    expect(mockBot.ship.health).toBe(80); // 100 - 20 = 80
    expect(mockBot.ship.lastDamageTime).toBe(60); // FPS value
    expect(mockBot.ship.healthRegenTimer).toBe(300); // 5 * 60
  });

  it('should trigger bot explosion when health reaches 0', async () => {
    // Import the function after mocking
    const { detectPlayerRoidCollisions } = await import('../src/physics/collision/shipCollisions');

    // Create a mock bot with low health
    const mockBot = {
      id: 'test-bot',
      botType: 'aggressive' as const,
      ship: {
        id: 'test-bot-ship',
        position: { x: 0, y: 0 },
        r: 15,
        health: 20, // Low health
        maxHealth: 100,
        exploding: false,
        blinkCount: 0,
        spawnProtectedUntil: 0,
        lastDamageTime: 0,
        healthRegenTimer: 0,
        explodeTime: 0,
        takeDamage: (amount: number) => {
          mockBot.ship.health = Math.max(0, mockBot.ship.health - amount);
          mockBot.ship.lastDamageTime = 60; // FPS value
          mockBot.ship.healthRegenTimer = 300; // 5 * 60
          if (mockBot.ship.health <= 0) {
            mockBot.ship.health = 0;
            mockBot.ship.exploding = true;
            mockBot.ship.explodeTime = 18;
            // Simulate the shipExploded event dispatch that would happen in real code
            window.dispatchEvent(
              new CustomEvent('shipExploded', {
                detail: {
                  shipId: mockBot.ship.id || 'test-bot-ship',
                  position: { x: mockBot.ship.position.x, y: mockBot.ship.position.y },
                },
              })
            );
          }
        },
      },
      spawnProtectedUntil: 0,
      respawnTimer: undefined,
    };

    // Create a mock roid belt with one roid
    const mockRoidBelt = {
      roids: [
        {
          position: { x: 10, y: 0 }, // Close enough to collide
          r: 20,
        },
      ],
    };

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      bots,
      mockRoidBelt as unknown as import('../src/entities/roid/Roid').RoidBelt
    );

    // Verify explosion was triggered
    expect(mockBot.ship.health).toBe(0);
    expect(mockBot.ship.exploding).toBe(true);
    expect(mockBot.ship.explodeTime).toBe(18);
    // Note: respawnTimer is set by botManager.updateBotsInGameLoop(), not by collision detection
    // The collision detection only triggers the explosion, the bot manager handles respawn timing
  });

  it('should skip invincible bots (blinking)', async () => {
    // Import the function after mocking
    const { detectPlayerRoidCollisions } = await import('../src/physics/collision/shipCollisions');

    // Create a mock bot that is blinking (invincible)
    const mockBot = {
      id: 'test-bot',
      botType: 'aggressive' as const,
      ship: {
        position: { x: 0, y: 0 },
        r: 15,
        health: 100,
        maxHealth: 100,
        exploding: false,
        blinkCount: 5, // Invincible
        spawnProtectedUntil: 0,
        lastDamageTime: 0,
        healthRegenTimer: 0,
        explodeTime: 0,
      },
      spawnProtectedUntil: 0,
    };

    // Create a mock roid belt with one roid
    const mockRoidBelt = {
      roids: [
        {
          position: { x: 10, y: 0 }, // Close enough to collide
          r: 20,
        },
      ],
    };

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      bots,
      mockRoidBelt as unknown as import('../src/entities/roid/Roid').RoidBelt
    );

    // Verify no damage was applied
    expect(mockBot.ship.health).toBe(100); // Health unchanged
    expect(mockBot.ship.lastDamageTime).toBe(0); // No damage time set
  });
});
