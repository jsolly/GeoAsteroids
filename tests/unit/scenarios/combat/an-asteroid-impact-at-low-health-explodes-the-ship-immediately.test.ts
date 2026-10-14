import { describe, expect, test } from 'vitest';
import { DAMAGE, GAME, SHIP } from '../../../../shared/constants/gameplay';
import { Ship } from '../../../../src/entities/ship/Ship';
import {
  EXPLOSION_FRAMES,
  GameServerWorld,
  SPAWN_PROTECTION_FRAMES,
  useQuietServerConsole,
} from '../support/gameServerWorld';
import { SHIP_KINDS } from '../support/shipKinds';

useQuietServerConsole();

const LOW_HEALTH = DAMAGE.ASTEROID_COLLISION - 5;

describe.each(SHIP_KINDS)('An asteroid impacts a $kind', ({ options }) => {
  test('at full health it survives and loses one asteroid impact of health', () => {
    const ship = new Ship(options);
    ship.takeDamage(DAMAGE.ASTEROID_COLLISION);

    expect(ship.health).toBe(SHIP.MAX_HEALTH - DAMAGE.ASTEROID_COLLISION);
    expect(ship.exploding).toBe(false);
  });

  test('at low health it explodes on the very same frame, without waiting for the server', () => {
    const ship = new Ship(options);
    ship.health = LOW_HEALTH;
    ship.takeDamage(DAMAGE.ASTEROID_COLLISION);

    expect(ship.health).toBe(0);
    expect(ship.exploding).toBe(true);
  });

  test('an exploding ship cannot be hit again, and the explosion resolves in 0.3s', () => {
    const ship = new Ship(options);
    ship.health = LOW_HEALTH;
    ship.takeDamage(DAMAGE.ASTEROID_COLLISION);
    ship.takeDamage(DAMAGE.ASTEROID_COLLISION);

    expect(ship.health).toBe(0);
    for (let frame = 0; frame < EXPLOSION_FRAMES; frame++) {
      ship.update();
    }
    expect(ship.explodeTime).toBe(0);
    expect(ship.exploding).toBe(true);
    expect(EXPLOSION_FRAMES / GAME.FPS).toBeCloseTo(0.3);
  });
});

describe('Server view: environmental damage', () => {
  test('destroys the target, costs a life, and sends a destruction event in one go', () => {
    const world = new GameServerWorld();
    const bob = world.join('Bob', { x: 20, y: 0 });
    world.tick(SPAWN_PROTECTION_FRAMES);

    world.hitAsteroid(bob);
    world.hitAsteroid(bob);
    world.hitAsteroid(bob);
    expect(world.entity(bob).health).toBe(DAMAGE.ASTEROID_COLLISION);

    bob.socket.clear();
    world.hitAsteroid(bob);

    expect(world.entity(bob).health).toBe(0);
    expect(world.entity(bob).exploding).toBe(true);
    expect(bob.socket.lastReceived('playerDamaged')?.data).toMatchObject({
      targetPlayerId: bob.id,
      remainingHealth: 0,
      isDestroyed: true,
    });
    expect(bob.socket.lastReceived('playerDamaged')?.data).toMatchObject({
      targetPlayerId: bob.id,
      attackerId: 'asteroid',
    });

    world.dispose();
  });
});
