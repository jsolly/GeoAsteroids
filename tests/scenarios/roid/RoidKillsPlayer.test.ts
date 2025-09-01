import { describe, expect, test } from 'vitest';
import { ROID } from '../../../src/constants';
import { Roid, RoidBelt } from '../../../src/entities/roid/Roid';
import { Player } from '../../../src/entities/player/Player';
import { detectRoidHits } from '../../../src/physics/collision/shipCollisions';

import './roid-utils';

describe('Roid Kills Player Scenario', () => {

  test('should kill player with low health when hit by roid', () => {

    // Create a player with low health (1/100)
    const player = new Player({
      id: 'test-player',
      name: 'TestPlayer',
      type: 'local'
    });
    player.ship.health = 1;
    player.ship.maxHealth = 100;
    const initialLives = player.lives;


    // Disable spawn protection
    player.ship.blinkCount = 0;
    player.ship.spawnProtectionTimer = 0;
    player.ship.blinkOn = false;

    // Create roid belt with one large roid directly on top of player
    const roidBelt = new RoidBelt(false);
    const roidPosition = {
      x: player.ship.position.x,
      y: player.ship.position.y
    };
    const roid = new Roid(roidPosition, Math.ceil(ROID.SIZE / 2)); // Large roid
    roidBelt.roids.push(roid);


    // Trigger collision detection - the core scenario we're testing
    // In multiplayer mode, scoring is handled server-side, so we just verify the collision logic
    const score = detectRoidHits(player.ship, roidBelt);

    // Verify Asteroid is split into two medium asteroids
    expect(roidBelt.roids.length).toBe(2);
    expect(roidBelt.roids[0].r).toBe(Math.ceil(ROID.SIZE / 4)); // Medium roids have radius Math.ceil(ROID.SIZE / 4)
    expect(roidBelt.roids[1].r).toBe(Math.ceil(ROID.SIZE / 4));

    // Verify collision detection returns correct score (server handles actual scoring)
    expect(score).toBe(ROID.POINTS_LARGE);

    // Verify ship is exploding
    expect(player.ship.exploding).toBe(true);

    // Verify player lost a life
    expect(player.lives).toBe(initialLives - 1);

    // Verify Death screen is displayed
    expect(player.deathCause).toBe('colliding with an asteroid. Space rocks are not your friends!');
  });
});
