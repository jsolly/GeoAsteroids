import { beforeEach, describe, expect, test } from 'vitest';
import { Player } from '../../../src/entities/player/Player';

describe('Player Respawn System', () => {
  let player: Player;
  let ship: Player['ship'];

  beforeEach(() => {
    player = new Player({
      id: 'test-player',
      name: 'Test Player',
      type: 'local',
    });
    ship = player.ship;
  });

  test('a living local ship displays gradual authoritative healing and subsequent damage', () => {
    player.updateFromServer({ health: 50, exploding: false });
    expect(ship.health).toBe(50);

    player.updateFromServer({ health: 50 + 1 / 60, exploding: false });
    expect(ship.health).toBeCloseTo(50 + 1 / 60);
    player.updateFromServer({ health: 50 + 2 / 60, exploding: false });
    expect(ship.health).toBeCloseTo(50 + 2 / 60);

    // Repeated snapshots must not add healing locally, and actual damage
    // following regeneration must still be reflected immediately.
    player.updateFromServer({ health: 50 + 2 / 60, exploding: false });
    expect(ship.health).toBeCloseTo(50 + 2 / 60);
    player.updateFromServer({ health: 47 + 2 / 60, exploding: false });
    expect(ship.health).toBeCloseTo(47 + 2 / 60);
  });

  test('a delayed healing echo cannot revive a locally predicted death', () => {
    player.updateFromServer({ health: 50, exploding: false });
    ship.health = 0;
    ship.exploding = true;
    ship.blinkCount = 0;

    player.updateFromServer({ health: 50 + 1 / 60, exploding: false });
    expect(ship.health).toBe(0);
    expect(ship.blinkCount).toBe(0);

    // A complete authoritative respawn still restores health and its cue.
    player.updateFromServer({
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0,
    });
    expect(ship.health).toBe(ship.maxHealth);
    expect(ship.blinkCount).toBeGreaterThan(0);
  });

  test('player respawns with full health when health updates from server', () => {
    // Simulate death
    ship.health = 0;
    ship.exploding = true;

    // Simulate server sending respawn data
    const respawnData = {
      health: ship.maxHealth,
      exploding: false,
      respawnTimer: 0,
    };

    // Update from server
    player.updateFromServer(respawnData);

    // Should have full health and not be exploding
    expect(ship.health).toBe(ship.maxHealth);
    expect(ship.exploding).toBe(false);
    expect(ship.blinkCount).toBeGreaterThan(0);
    expect(ship.spawnProtectionTimer).toBeGreaterThan(0);
    expect(ship.blinkOn).toBe(true);
  });
});
