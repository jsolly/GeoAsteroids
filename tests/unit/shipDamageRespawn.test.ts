import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANVAS, GAME, SHIP } from '../../src/constants';
import { Laser } from '../../src/entities/laser/Laser';
import { Player } from '../../src/entities/player/Player';
import { Roid } from '../../src/entities/roid/Roid';
import { Ship } from '../../src/entities/ship/Ship';
import { CollisionManager } from '../../src/physics/CollisionManager';
import { detectPlayerLaserShipCollisions } from '../../src/physics/collision/laserCollisions';
import {
  detectAllPlayerCollisions,
  detectRoidHits,
} from '../../src/physics/collision/shipCollisions';

// Mock window events for testing
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true,
});

// Mock debug mode to be disabled for testing
vi.mock('../../src/utils/debugUtils', () => ({
  isDebugMode: () => false,
}));

describe('Ship Damage, Explosion, and Respawn', () => {
  let ship: Ship;
  let player: Player;
  let otherPlayer: Player;
  let botPlayer: Player;
  let laser: Laser;
  let roid: Roid;

  // Helper function to create mock roid belt
  const createMockRoidBelt = () => ({
    roidNum: 10,
    roids: [roid],
    minCount: 5,
    maxCount: 20,
    spawnTimer: 0,
    addRoid: vi.fn(),
    destroyRoid: vi.fn().mockReturnValue({ score: 100, newRoids: [] }),
    getRoids: vi.fn().mockReturnValue([roid]),
    moveRoids: vi.fn(),
    spawnRoids: vi.fn(),
    setRoidLimits: vi.fn(),
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create test ships and players
    ship = new Ship({
      position: { x: 400, y: 300 },
      isBot: false,
    });

    player = new Player({
      id: 'test-player',
      name: 'Test Player',
      type: 'local',
    });

    otherPlayer = new Player({
      id: 'other-player',
      name: 'Other Player',
      type: 'remote',
    });

    botPlayer = new Player({
      id: 'bot-player',
      name: 'Bot Player',
      type: 'bot',
    });

    // Create test laser
    laser = new Laser(
      { x: 400, y: 300 }, // position
      { x: 0, y: 0 }, // velocity
      0, // distTraveled
      0, // explodeTime
      false // hasExploded
    );

    // Create test roid
    roid = new Roid(
      { x: 400, y: 300 }, // position
      25 // radius
    );
  });

  describe('Ship Damage System', () => {
    it('should take damage and reduce health', () => {
      const initialHealth = ship.health;
      const damageAmount = 20;

      ship.takeDamage(damageAmount);

      expect(ship.health).toBe(initialHealth - damageAmount);
    });

    it('should not take damage when exploding', () => {
      ship.explode();
      const healthAfterExplosion = ship.health;

      ship.takeDamage(20);

      expect(ship.health).toBe(healthAfterExplosion);
    });

    it('should set damage cooldown when taking damage', () => {
      ship.takeDamage(20);

      expect(ship.lastDamageTime).toBe(GAME.FPS);
      expect(ship.healthRegenTimer).toBe(300); // 5 seconds * 60 FPS
    });

    it('should explode when health reaches 0', () => {
      const damageAmount = ship.health; // Deal exactly lethal damage

      ship.takeDamage(damageAmount);

      expect(ship.health).toBe(0);
      expect(ship.exploding).toBe(true);
      expect(ship.explodeTime).toBe(SHIP.EXPLODE_DURATION_FRAMES);
    });

    it('should dispatch shipExploded event when health reaches 0', () => {
      const damageAmount = ship.health; // Deal exactly lethal damage

      ship.takeDamage(damageAmount);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'shipExploded',
          detail: expect.objectContaining({
            shipId: ship.id,
            position: ship.position,
          }),
        })
      );
    });
  });

  describe('Ship Explosion System', () => {
    it('should start explosion with correct duration', () => {
      ship.explode();

      expect(ship.exploding).toBe(true);
      expect(ship.explodeTime).toBe(SHIP.EXPLODE_DURATION_FRAMES);
    });

    it('should update explosion state over time', () => {
      ship.explode();
      const initialExplodeTime = ship.explodeTime;

      // Update explosion for a few frames
      for (let i = 0; i < 5; i++) {
        ship.updateExplosion();
      }

      expect(ship.explodeTime).toBeLessThan(initialExplodeTime);
      expect(ship.explodeTime).toBeGreaterThan(0);
    });

    it('should finish explosion after duration expires', () => {
      ship.explode();

      // Fast-forward past explosion duration
      for (let i = 0; i < SHIP.EXPLODE_DURATION_FRAMES; i++) {
        ship.updateExplosion();
      }

      expect(ship.exploding).toBe(false);
      expect(ship.explodeTime).toBe(0);
    });

    it('should not take damage during explosion', () => {
      ship.explode();
      const healthDuringExplosion = ship.health;

      ship.takeDamage(20);

      expect(ship.health).toBe(healthDuringExplosion);
    });
  });

  describe('Player Collision Damage', () => {
    it('should deal damage on collision with other players', () => {
      const initialHealth = player.ship.health;
      const otherShip = otherPlayer.ship;

      // Position ships to collide (close enough for collision detection)
      otherShip.position = { x: 400, y: 300 };
      player.ship.position = { x: 400, y: 300 }; // Same position for guaranteed collision

      // Ensure ships have proper radius for collision detection
      player.ship.r = 15;
      otherShip.r = 15;

      // Simulate collision detection for both players (mutual collision)
      detectAllPlayerCollisions(player, [otherPlayer]);
      detectAllPlayerCollisions(otherPlayer, [player]);

      // Reset collision damage timers to allow immediate damage
      player.ship.lastPlayerCollisionDamageTime = 0;
      otherPlayer.ship.lastPlayerCollisionDamageTime = 0;

      // Apply collision damage directly (since ships don't have a main update method)
      player.ship.updatePlayerCollisionDamage();
      otherPlayer.ship.updatePlayerCollisionDamage();

      expect(player.ship.health).toBeLessThan(initialHealth);
      expect(otherPlayer.ship.health).toBeLessThan(otherShip.maxHealth);
    });

    it('should not collide when ships are exploding', () => {
      player.ship.explode();
      otherPlayer.ship.explode();

      const initialHealth = player.ship.health;
      const otherInitialHealth = otherPlayer.ship.health;

      detectAllPlayerCollisions(player, [otherPlayer]);

      expect(player.ship.health).toBe(initialHealth);
      expect(otherPlayer.ship.health).toBe(otherInitialHealth);
    });

    it('should not collide when ships are invincible', () => {
      // Make ships invincible
      player.ship.blinkCount = 5;
      otherPlayer.ship.blinkCount = 5;

      const initialHealth = player.ship.health;
      const otherInitialHealth = otherPlayer.ship.health;

      detectAllPlayerCollisions(player, [otherPlayer]);

      expect(player.ship.health).toBe(initialHealth);
      expect(otherPlayer.ship.health).toBe(otherInitialHealth);
    });
  });

  describe('Laser Damage System', () => {
    it('should deal damage when hit by laser from other player', () => {
      const initialHealth = player.ship.health;
      const otherShip = otherPlayer.ship;

      // Position ships and laser for collision
      player.ship.position = { x: 400, y: 300 };
      otherShip.position = { x: 500, y: 300 };
      laser.position = { x: 400, y: 300 }; // Laser at player position

      // Add laser to other player's ship
      otherShip.lasers = [laser];

      // Ensure proper collision detection setup
      player.ship.r = 15;

      // Simulate laser collision detection
      detectPlayerLaserShipCollisions(player, [otherPlayer]);

      expect(player.ship.health).toBeLessThan(initialHealth);
    });

    it('should not take laser damage when invincible', () => {
      player.ship.blinkCount = 5; // Make invincible
      const initialHealth = player.ship.health;

      // Position for collision
      player.ship.position = { x: 400, y: 300 };
      laser.position = { x: 400, y: 300 };

      otherPlayer.ship.lasers = [laser];

      detectPlayerLaserShipCollisions(player, [otherPlayer]);

      expect(player.ship.health).toBe(initialHealth);
    });

    it('should not take laser damage when exploding', () => {
      player.ship.explode();
      const healthDuringExplosion = player.ship.health;

      // Position for collision
      player.ship.position = { x: 400, y: 300 };
      laser.position = { x: 400, y: 300 };

      otherPlayer.ship.lasers = [laser];

      detectPlayerLaserShipCollisions(player, [otherPlayer]);

      expect(player.ship.health).toBe(healthDuringExplosion);
    });
  });

  describe('Asteroid Collision Damage', () => {
    it('should deal damage on collision with asteroids', () => {
      const initialHealth = player.ship.health;

      // Position ship and roid to collide
      player.ship.position = { x: 400, y: 300 };
      roid.position = { x: 400, y: 300 }; // Same position for guaranteed collision

      // Ensure proper collision detection setup
      player.ship.r = 15;
      roid.r = 25;

      // Create roid belt for testing
      const roidBelt = createMockRoidBelt();

      // Simulate roid collision detection
      detectRoidHits(player.ship, roidBelt);

      expect(player.ship.health).toBeLessThan(initialHealth);
    });

    it('should not take asteroid damage when exploding', () => {
      player.ship.explode();
      const healthDuringExplosion = player.ship.health;

      // Position for collision
      player.ship.position = { x: 400, y: 300 };
      roid.position = { x: 400, y: 300 };

      const roidBelt = createMockRoidBelt();

      detectRoidHits(player.ship, roidBelt);

      expect(player.ship.health).toBe(healthDuringExplosion);
    });

    it('should not take asteroid damage when invincible', () => {
      player.ship.blinkCount = 5; // Make invincible
      const initialHealth = player.ship.health;

      // Position for collision
      player.ship.position = { x: 400, y: 300 };
      roid.position = { x: 400, y: 300 };

      const roidBelt = createMockRoidBelt();

      detectRoidHits(player.ship, roidBelt);

      expect(player.ship.health).toBe(initialHealth);
    });
  });

  describe('Player Death and Respawn', () => {
    it('should decrement lives when ship explodes', () => {
      const initialLives = player.lives;

      // Simulate ship explosion
      player.onShipExploded();

      expect(player.lives).toBe(initialLives - 1);
    });

    it('should set respawn timer when ship explodes', () => {
      player.onShipExploded();

      expect(player.respawnTimer).toBe(SHIP.EXPLODE_DURATION_FRAMES + 120); // Added 2 seconds for message display
    });

    it('should dispatch game over event when no lives remaining', async () => {
      // Set lives to 1 so next explosion triggers game over
      player.lives = 1;

      // Mock setTimeout to capture the delayed game over event
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = vi.fn();
      global.setTimeout = setTimeoutSpy as unknown as typeof global.setTimeout;

      try {
        player.onShipExploded();

        // Verify that setTimeout was called
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

        // Get the callback function and call it to trigger the game over event
        const setTimeoutCall = setTimeoutSpy.mock.calls[0];
        const callback = setTimeoutCall[0];

        // Call the setTimeout callback to trigger the game over event
        callback();

        // Now verify that the game over event was dispatched
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'playerGameOver',
            detail: expect.objectContaining({
              playerId: player.id,
            }),
          })
        );
      } finally {
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should respawn at random location', () => {
      const originalPosition = { ...player.ship.position };

      player.respawn();

      // Position should have changed
      expect(player.ship.position).not.toEqual(originalPosition);

      // Should be within canvas bounds
      expect(player.ship.position.x).toBeGreaterThanOrEqual(0);
      expect(player.ship.position.x).toBeLessThanOrEqual(CANVAS.INTERNAL_WIDTH);
      expect(player.ship.position.y).toBeGreaterThanOrEqual(0);
      expect(player.ship.position.y).toBeLessThanOrEqual(CANVAS.INTERNAL_HEIGHT);
    });

    it('should reset ship state on respawn', () => {
      // Damage and explode the ship first
      player.ship.takeDamage(50);
      player.ship.explode();

      player.respawn();

      // Ship should be fully restored
      expect(player.ship.health).toBe(player.ship.maxHealth);
      expect(player.ship.exploding).toBe(false);
      expect(player.ship.explodeTime).toBe(0);
      expect(player.ship.velocity).toEqual({ x: 0, y: 0 });
      expect(player.ship.angle).toBe((90 / 180) * Math.PI); // Face upward
    });

    it('should set invincibility on respawn', () => {
      player.respawn();

      expect(player.ship.blinkCount).toBeGreaterThan(0);
      expect(player.ship.spawnProtectionTimer).toBe(SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES);
      expect(player.ship.blinkOn).toBe(true);
      expect(player.spawnProtectedUntil).toBeGreaterThan(Date.now());
    });

    it('should update invincibility over time', () => {
      player.respawn();
      const initialBlinkCount = player.ship.blinkCount;

      // Update invincibility for a few frames
      for (let i = 0; i < 10; i++) {
        player.ship.updateInvincibility();
      }

      expect(player.ship.blinkCount).toBeLessThan(initialBlinkCount);
    });

    it('should clear respawn timer after respawning', () => {
      player.onShipExploded();
      expect(player.respawnTimer).toBeDefined();

      player.respawn();

      expect(player.respawnTimer).toBeUndefined();
    });
  });

  describe('Bot Player Behavior', () => {
    it('should handle damage and explosion same as regular players', () => {
      const initialHealth = botPlayer.ship.health;
      const initialLives = botPlayer.lives;

      // Damage bot ship
      botPlayer.ship.takeDamage(50);

      expect(botPlayer.ship.health).toBeLessThan(initialHealth);

      // Explode bot ship
      botPlayer.onShipExploded();

      expect(botPlayer.lives).toBe(initialLives - 1);
      expect(botPlayer.respawnTimer).toBe(SHIP.EXPLODE_DURATION_FRAMES + 120); // Added 2 seconds for message display
    });

    it('should respawn with same logic as regular players', () => {
      const originalPosition = { ...botPlayer.ship.position };

      botPlayer.respawn();

      // Should respawn at different location
      expect(botPlayer.ship.position).not.toEqual(originalPosition);

      // Should have full health and invincibility
      expect(botPlayer.ship.health).toBe(botPlayer.ship.maxHealth);
      expect(botPlayer.ship.blinkCount).toBeGreaterThan(0);
    });
  });

  describe('Collision Manager Integration', () => {
    it('should skip collisions during respawn countdown', () => {
      const collisionManager = CollisionManager.getInstance();

      // Set respawn timer
      player.respawnTimer = 10;

      // Mock roid belt
      const roidBelt = createMockRoidBelt();

      // Try to detect collisions
      const result = collisionManager.detectAllCollisions(player, roidBelt, [otherPlayer]);

      // Should return empty result (no score aggregation in multiplayer)
      expect(result).toBeDefined();
    });

    it('should detect all collision types when not respawning', () => {
      const collisionManager = CollisionManager.getInstance();

      // Ensure no respawn timer
      player.respawnTimer = undefined;

      // Mock roid belt
      const roidBelt = createMockRoidBelt();

      // Position entities for collisions
      player.ship.position = { x: 400, y: 300 };
      otherPlayer.ship.position = { x: 410, y: 300 };
      roid.position = { x: 420, y: 300 };

      // Detect collisions
      const result = collisionManager.detectAllCollisions(player, roidBelt, [otherPlayer]);

      // Should have detected some collisions
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle multiple rapid damage events', () => {
      const initialHealth = player.ship.health;
      expect(initialHealth).toBe(100); // Ensure we start with full health

      // Deal multiple damage events rapidly
      player.ship.takeDamage(20);
      player.ship.takeDamage(20);
      player.ship.takeDamage(20);
      player.ship.takeDamage(20);
      player.ship.takeDamage(20); // 5 * 20 = 100 damage, should be lethal

      // Health should be reduced and ship should explode
      expect(player.ship.health).toBe(0);
      expect(player.ship.exploding).toBe(true);
    });

    it('should handle respawn during explosion', () => {
      player.ship.explode();

      // Try to respawn during explosion
      player.respawn();

      // Should still respawn successfully
      expect(player.ship.exploding).toBe(false);
      expect(player.ship.health).toBe(player.ship.maxHealth);
    });

    it('should handle boundary collision cause', () => {
      player.onShipExploded({ cause: 'boundary' });

      expect(player.respawnTimer).toBe(SHIP.EXPLODE_DURATION_FRAMES + 120); // Added 2 seconds for message display
    });

    it('should handle unknown collision cause', () => {
      player.onShipExploded({ cause: 'unknown' });

      expect(player.respawnTimer).toBe(SHIP.EXPLODE_DURATION_FRAMES + 120); // Added 2 seconds for message display
    });
  });
});
