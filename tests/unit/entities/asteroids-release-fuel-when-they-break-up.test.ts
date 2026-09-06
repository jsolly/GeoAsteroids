import { beforeEach, describe, expect, test } from 'vitest';
import type { AsteroidData } from '../../../shared-types';
import { FUEL } from '../../../src/constants';
import { GameEngine } from '../../../server/core/GameEngine';

function makeAsteroid(id: string, size: number): AsteroidData {
  return {
    id,
    position: { x: 400, y: 300 },
    velocity: { x: 1, y: 0 },
    size,
    jaggedness: 0.5,
    rotation: 0,
    angularVelocity: 0,
    health: 50,
    maxHealth: 50,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
  };
}

describe('asteroids release fuel when they break up', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(12345);
  });

  test('a medium-or-larger asteroid drops fuel at the breakup point', () => {
    engine.addAsteroid(makeAsteroid('big-1', 30));

    const result = engine.handleAsteroidDestruction('big-1', 'nobody', 20);

    expect(result.success).toBe(true);
    expect(result.fuelDrop).toBeDefined();
    expect(result.fuelDrop?.amount).toBe(FUEL.DROP_AMOUNT);
    expect(result.fuelDrop?.position).toEqual({ x: 400, y: 300 });
    expect(engine.getAllFuelDrops()).toHaveLength(1);
  });

  test('a small asteroid does not drop fuel', () => {
    engine.addAsteroid(makeAsteroid('small-1', 12));

    const result = engine.handleAsteroidDestruction('small-1', 'nobody', 100);

    expect(result.success).toBe(true);
    expect(result.fuelDrop).toBeUndefined();
    expect(engine.getAllFuelDrops()).toHaveLength(0);
  });
});
