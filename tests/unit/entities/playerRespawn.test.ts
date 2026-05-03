import { expect, test, describe, beforeEach } from 'vitest';
import { Player } from '../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import { SHIP } from '../../../src/constants';

describe('Player Respawn System', () => {
  let player: Player;
  let ship: any;

  beforeEach(() => {
    player = new Player({
      id: 'test-player',
      name: 'Test Player',
      type: 'local',
      input: new MockPlayerInput()
    });
    ship = player.ship;
  });

  test('player starts with full health', () => {
    expect(ship.health).toBe(ship.maxHealth);
    expect(ship.exploding).toBe(false);
  });

  test('player can take damage', () => {
    const initialHealth = ship.health;
    ship.takeDamage(25);
    expect(ship.health).toBe(initialHealth - 25);
  });

  test('player explodes when health reaches zero', () => {
    ship.takeDamage(ship.maxHealth);
    expect(ship.health).toBe(0);
    expect(ship.exploding).toBe(true);
  });

  test('player respawns with full health when health updates from server', () => {
    // Simulate death
    ship.health = 0;
    ship.exploding = true;
    
    // Simulate server sending respawn data
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0
    };
    
    // Update from server
    player.updateFromServer(respawnData);
    
    // Should have full health and not be exploding
    expect(ship.health).toBe(ship.maxHealth);
    expect(ship.exploding).toBe(false);
  });

  test('player gets spawn protection when respawning', () => {
    // Simulate death
    ship.health = 0;
    ship.exploding = true;
    
    // Simulate server sending respawn data
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0
    };
    
    // Update from server
    player.updateFromServer(respawnData);
    
    // Should have spawn protection (blinking)
    expect(ship.blinkCount).toBeGreaterThan(0);
    expect(ship.spawnProtectionTimer).toBeGreaterThan(0);
    expect(ship.blinkOn).toBe(true);
  });

  test('spawn protection values are correct', () => {
    // Simulate death and respawn
    ship.health = 0;
    ship.exploding = true;
    
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0
    };
    
    player.updateFromServer(respawnData);
    
    // Check that spawn protection values match constants
    const expectedBlinkCount = Math.ceil(
      SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
    );
    const expectedSpawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
    
    expect(ship.blinkCount).toBe(expectedBlinkCount);
    expect(ship.spawnProtectionTimer).toBe(expectedSpawnProtectionTimer);
  });

  test('spawn protection updates over time', () => {
    // Simulate death and respawn
    ship.health = 0;
    ship.exploding = true;
    
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0
    };
    
    player.updateFromServer(respawnData);
    
    const initialSpawnProtectionTimer = ship.spawnProtectionTimer;
    
    // Update invincibility (simulate game loop)
    ship.updateInvincibility();
    
    // Should have decremented
    expect(ship.spawnProtectionTimer).toBeLessThan(initialSpawnProtectionTimer);
  });

  test('spawn protection expires after all blinks', () => {
    // Simulate death and respawn
    ship.health = 0;
    ship.exploding = true;
    
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0
    };
    
    player.updateFromServer(respawnData);
    
    // Run through all invincibility frames (180 frames total)
    const totalFrames = SHIP.INVINCIBILITY_DURATION_FRAMES;
    for (let i = 0; i < totalFrames; i++) {
      ship.updateInvincibility();
    }
    
    // Should have no more spawn protection
    expect(ship.blinkCount).toBe(0);
    // The timer should be at its initial value (6) when blinkCount reaches 0
    expect(ship.spawnProtectionTimer).toBe(SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES);
  });
});
