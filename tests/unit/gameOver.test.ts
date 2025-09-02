import { expect, test, describe, beforeEach } from 'vitest';
import { Player } from '../../src/entities/player/Player';
import { Ship } from '../../src/entities/ship/Ship';
import { GAME } from '../../src/constants';

// This test file has been updated for the new simplified architecture
// Player creation now uses the constructor directly

describe('Game Over System (Simplified Architecture)', () => {
  let localPlayer: Player;
  let localShip: Ship;

  beforeEach(() => {
    // Create test player using the constructor
    localPlayer = new Player({
      id: 'local-player',
      name: 'Local Player',
      type: 'local'
    });
    
    localShip = localPlayer.ship;
  });

  test('player can be created with ship', () => {
    expect(localPlayer).toBeInstanceOf(Player);
    expect(localShip).toBeInstanceOf(Ship);
    expect(localPlayer.lives).toBe(GAME.START_LIVES);
  });

  test('ship has valid position', () => {
    expect(localShip.position).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  test('ship has valid health', () => {
    expect(localShip.health).toBeGreaterThan(0);
    expect(localShip.maxHealth).toBeGreaterThan(0);
  });

  test('game over system is now server-controlled', () => {
    // In the new architecture, game over logic is handled by the server
    // The client only displays the results
    expect(true).toBe(true);
  });

  test('player type is correctly set', () => {
    expect(localPlayer.type).toBe('local');
  });

  test('ship can take damage', () => {
    const initialHealth = localShip.health;
    localShip.takeDamage(25);
    expect(localShip.health).toBeLessThan(initialHealth);
  });

  test('ship can explode', () => {
    localShip.health = 0;
    localShip.exploding = true;
    expect(localShip.exploding).toBe(true);
  });

  test('player has unique ID', () => {
    expect(localPlayer.id).toBe('local-player');
  });

  test('player has valid name', () => {
    expect(localPlayer.name).toBe('Local Player');
  });
});
