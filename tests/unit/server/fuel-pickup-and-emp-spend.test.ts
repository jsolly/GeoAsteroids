import { beforeEach, describe, expect, test } from 'vitest';
import type { AsteroidData } from '../../../shared-types';
import { FUEL } from '../../../src/constants';
import { GameEngine } from '../../../server/core/GameEngine';
import type { GameEntity } from '../../../server/core/EntityManager';

function makeAsteroid(id: string, size: number): AsteroidData {
  return {
    id,
    position: { x: 100, y: 80 },
    velocity: { x: 0, y: 0 },
    size,
    jaggedness: 0.5,
    rotation: 0,
    angularVelocity: 0,
    health: 40,
    maxHealth: 40,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
  };
}

function addHuman(engine: GameEngine, id: string): GameEntity {
  const entity: GameEntity = {
    id,
    name: 'Pilot',
    type: 'human',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    exploding: false,
    thrusting: false,
    color: '#5EEAD4',
    lives: 3,
    score: 0,
    health: 100,
    maxHealth: 100,
    fuel: FUEL.START,
    maxFuel: FUEL.MAX,
    lastUpdate: Date.now(),
  };
  engine.entityManager.addEntity(entity);
  return entity;
}

describe('server fuel pickup and EMP spend', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(99);
  });

  test('human and bot ships fill from the same pickup handler', () => {
    const human = addHuman(engine, 'human-1');
    const bots = engine.createBots(1);
    expect(bots).not.toBeNull();
    const bot = bots![0];
    expect(bot).toBeDefined();

    engine.addAsteroid(makeAsteroid('roid-a', 30));
    engine.addAsteroid(makeAsteroid('roid-b', 30));
    const first = engine.handleAsteroidDestruction('roid-a', human.id, 20);
    const second = engine.handleAsteroidDestruction('roid-b', bot!.id, 20);
    expect(first.fuelDrop).toBeDefined();
    expect(second.fuelDrop).toBeDefined();

    expect(engine.handleFuelPickup(human.id, first.fuelDrop!.id)).toBe(true);
    expect(engine.handleFuelPickup(bot!.id, second.fuelDrop!.id)).toBe(true);

    expect(human.fuel).toBe(FUEL.START + FUEL.DROP_AMOUNT);
    expect(bot!.fuel).toBe(FUEL.START + FUEL.DROP_AMOUNT);
    expect(engine.getAllFuelDrops()).toHaveLength(0);
  });

  test('EMP spend is refused once the shared tank is empty', () => {
    const human = addHuman(engine, 'human-emp');
    const bots = engine.createBots(1);
    const bot = bots![0];
    expect(bot).toBeDefined();

    expect(engine.handleEmpPulse(human.id)).toBe(true);
    expect(human.fuel).toBe(FUEL.START - FUEL.EMP_COST);
    expect(engine.handleEmpPulse(bot!.id)).toBe(true);
    expect(bot!.fuel).toBe(FUEL.START - FUEL.EMP_COST);

    human.fuel = 0;
    bot!.fuel = FUEL.EMP_COST - 1;
    expect(engine.handleEmpPulse(human.id)).toBe(false);
    expect(engine.handleEmpPulse(bot!.id)).toBe(false);
    expect(human.fuel).toBe(0);
    expect(bot!.fuel).toBe(FUEL.EMP_COST - 1);
  });

  test('game state snapshots include fuel tanks and live drops', () => {
    const human = addHuman(engine, 'human-state');
    engine.addAsteroid(makeAsteroid('roid-state', 40));
    engine.handleAsteroidDestruction('roid-state', human.id, 20);

    const state = engine.getGameState();
    const snapshot = state.entities.find((entity) => entity.id === human.id);
    expect(snapshot?.fuel).toBe(FUEL.START);
    expect(snapshot?.maxFuel).toBe(FUEL.MAX);
    expect(state.fuelDrops).toHaveLength(1);
  });
});
