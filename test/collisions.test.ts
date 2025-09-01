import { describe, expect, it, vi } from 'vitest';
import { Laser } from '../src/entities/laser/Laser';
import { Player } from '../src/entities/player/Player';
import { Ship } from '../src/entities/ship/Ship';
import { detectLaserPlayerCollisions } from '../src/physics/collision/laserCollisions';

// Mock the constants
vi.mock('../src/constants', () => ({
  DEBUG: false,
  LASER_EXPLODE_DUR: 0.1,
  FPS: 60,
  SHIP_INV_DUR_FRAMES: 180,
  SHIP_INV_BLINK_DUR_FRAMES: 6,

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
      play: vi.fn().mockResolvedValue(undefined), // Return a resolved promise
    },
  },
}));

// Mock the playSound function
vi.mock('../src/audio/Sound.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../src/audio/Sound.ts');
  return {
    ...actual,
    playSound: vi.fn(),
  };
});

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

// Mock the MultiplayerManager
vi.mock('../src/multiplayer/multiplayerManager.ts', () => ({
  MultiplayerManager: {
    getInstance: vi.fn(() => ({
      isConnected: true, // Multiplayer mode only
      laserDamagePlayer: vi.fn(),
      laserDamageBot: vi.fn(),
      handleAsteroidDestruction: vi.fn(),
      asteroidDestroyed: vi.fn(),
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

    // Create a non-bot other player with a real ship instance
    const otherPlayerShip = new Ship();
    otherPlayerShip.position = { x: 100, y: 0 }; // Same position as laser
    otherPlayerShip.r = 15; // Player radius
    otherPlayerShip.blinkCount = 0; // No invincibility
    otherPlayerShip.blinkOn = false;
    otherPlayerShip.health = 100;
    otherPlayerShip.maxHealth = 100;

    const otherPlayer = Player.createPlayer({
      id: 'player-1',
      name: 'Player1',
      type: 'remote',
      position: { x: 100, y: 0 },
    });
    otherPlayer.ship = otherPlayerShip;
    otherPlayer.score = 0;
    otherPlayer.lastUpdate = Date.now();
    otherPlayer.lives = 3;
    otherPlayer.spawnProtectedUntil = Date.now() - 1000; // Spawn protection expired
    otherPlayer.color = '#ff0000'; // Test color for the other player

    // Add laser to ship
    ship.lasers = [laser];

    // Create a local player object with the ship
    const localPlayer = Player.createPlayer({
      id: 'local-player',
      name: 'LocalPlayer',
      type: 'local',
      position: { x: 0, y: 0 },
    });
    localPlayer.ship = ship;
    localPlayer.score = 0;
    localPlayer.lastUpdate = Date.now();
    localPlayer.lives = 3;
    localPlayer.color = '#00ff00'; // Test color for the local player

    return { laser, otherPlayer, localPlayer };
  }

  describe('detectLaserPlayerCollisions', () => {
    it('should detect collision when laser hits other player', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0); // Laser should explode
      // For remote players, damage should be handled by server, not locally
      expect(otherPlayer.ship.health).toBe(100); // Health should not change locally
    });

    it('should not detect collision when player is exploding', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      otherPlayer.ship.exploding = true;

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0); // Laser should not explode
      expect(otherPlayer.ship.health).toBe(100); // Health should not change
    });

    it('should not detect collision when player is invincible (blinking)', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      otherPlayer.ship.blinkCount = 10;
      otherPlayer.ship.blinkOn = true;

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should not detect collision when laser is already exploding', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      laser.explodeTime = 10; // Laser is already exploding

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle multiple players correctly', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();

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

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer, otherPlayer2]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(100); // Remote players don't take local damage
      expect(otherPlayer2.ship.health).toBe(100); // Second player should not be hit
    });

    it('should handle player death when health reaches 0', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      otherPlayer.ship.health = 10; // Low health

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(10); // Remote players don't take local damage
      expect(otherPlayer.lives).toBe(3); // Should not lose a life locally
      expect(otherPlayer.ship.exploding).toBe(false); // Should not start exploding locally
    });

    it('should handle player permanent death when no lives remaining', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      otherPlayer.ship.health = 10;
      otherPlayer.lives = 0; // No lives remaining

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(10); // Remote players don't take local damage
      expect(otherPlayer.lives).toBe(0);
      expect(otherPlayer.ship.exploding).toBe(false); // Should not be exploding locally
    });

    it('should handle all player types', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      // Note: In the refactored system, this function should only receive human players
      // Bot players are handled by a separate detection system

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(100); // Remote players don't take local damage
    });

    it('should handle collision threshold correctly', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      // Position laser just outside collision threshold
      laser.position = { x: 120, y: 0 }; // 100 + 15 (player radius) + 2 (laser radius) + 3 (extra buffer) = 120
      otherPlayer.ship.position = { x: 100, y: 0 };

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // No collision
      expect(laser.explodeTime).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle collision threshold correctly when laser is inside', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      // Position laser inside collision threshold
      laser.position = { x: 110, y: 0 }; // 100 + 10 (inside player radius)
      otherPlayer.ship.position = { x: 100, y: 0 };

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0);
      expect(otherPlayer.ship.health).toBe(100); // Remote players don't take local damage
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty players array', () => {
      const { laser, localPlayer } = createTestObjects();

      const score = detectLaserPlayerCollisions(localPlayer, []);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle undefined players array', () => {
      const { laser, localPlayer } = createTestObjects();

      const score = detectLaserPlayerCollisions(localPlayer, undefined);

      expect(score).toBe(0);
      expect(laser.explodeTime).toBe(0);
    });

    it('should handle ship with no lasers', () => {
      const { otherPlayer, localPlayer } = createTestObjects();
      localPlayer.ship.lasers = [];

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0);
      expect(otherPlayer.ship.health).toBe(100);
    });

    it('should handle multiple lasers hitting same player', () => {
      const { laser, otherPlayer, localPlayer } = createTestObjects();
      const laser2 = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
      laser2.explodeTime = 0;

      localPlayer.ship.lasers = [laser, laser2];

      const score = detectLaserPlayerCollisions(localPlayer, [otherPlayer]);

      expect(score).toBe(0); // Server handles all points in multiplayer mode
      expect(laser.explodeTime).toBeGreaterThan(0); // First laser should explode
      expect(laser2.explodeTime).toBeGreaterThan(0); // Second laser should also explode
      expect(otherPlayer.ship.health).toBe(100); // Remote players don't take local damage
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
    SHIP_POST_EXPLOSION_RESPAWN_DELAY: 60,
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

    // Create a mock local player
    const mockLocalPlayer = {
      id: 'local-player',
      ship: { position: { x: -100, y: -100 } }, // Far away so it doesn't interfere
    } as unknown as Player;

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      mockLocalPlayer,
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

    // Create a mock local player
    const mockLocalPlayer = {
      id: 'local-player',
      ship: { position: { x: -100, y: -100 } }, // Far away so it doesn't interfere
    } as unknown as Player;

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      mockLocalPlayer,
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

    // Create a mock local player
    const mockLocalPlayer = {
      id: 'local-player',
      ship: { position: { x: -100, y: -100 } }, // Far away so it doesn't interfere
    } as unknown as Player;

    // Create bots array and cast to expected types for testing
    const bots = [mockBot as unknown as Player];

    // Call the function
    detectPlayerRoidCollisions(
      mockLocalPlayer,
      bots,
      mockRoidBelt as unknown as import('../src/entities/roid/Roid').RoidBelt
    );

    // Verify no damage was applied
    expect(mockBot.ship.health).toBe(100); // Health unchanged
    expect(mockBot.ship.lastDamageTime).toBe(0); // No damage time set
  });

  it('should handle ship-to-ship collision with immediate explosion stop', async () => {
    // Import the function after mocking
    const { detectShipToShipCollisions } = await import('../src/physics/collision/shipCollisions');

    // Create two players that will collide
    const player1 = Player.createPlayer({
      id: 'player1',
      name: 'Player1',
      type: 'local',
      position: { x: 100, y: 100 },
    });

    const player2 = Player.createPlayer({
      id: 'player2',
      name: 'Player2',
      type: 'bot',
      position: { x: 105, y: 105 }, // Close enough to collide
    });

    // Set both ships to low health so they'll explode on collision
    player1.ship.health = 10;
    player2.ship.health = 10;

    // Mock window.dispatchEvent to capture explosion events
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    // Simulate ship-to-ship collision
    const score = detectShipToShipCollisions(player1.ship, [player2], player1);

    // Verify that only one explosion event was dispatched
    const explosionEvents = mockDispatchEvent.mock.calls.filter(
      (call) => call[0].type === 'shipExploded'
    );

    // Should have exactly one explosion event (from the first ship that explodes)
    expect(explosionEvents.length).toBe(1);

    // Verify that one of the ships exploded
    const ship1Exploded = player1.ship.exploding;
    const ship2Exploded = player2.ship.exploding;

    // Only one ship should have exploded (the first one that took damage)
    expect(ship1Exploded || ship2Exploded).toBe(true);
    expect(ship1Exploded && ship2Exploded).toBe(false);

    // Verify that the collision detection stopped after the first explosion
    expect(score).toBe(300); // Should award points for the destruction
  });
});
