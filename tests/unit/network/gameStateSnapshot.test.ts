import { expect, test } from 'vitest';
import type { AsteroidData, ServerEntityData } from '../../../shared-types';
import {
  encodeGameStateSnapshot,
  jsonUtf8Bytes,
  mergeWireGameState,
  quantizeAsteroid,
  quantizeNumber,
} from '../../../src/network/gameStateSnapshot';

function ship(id: string, overrides: Partial<ServerEntityData> = {}): ServerEntityData {
  return {
    id,
    name: id === 'human-1' ? 'Pilot' : 'Bot',
    type: id.startsWith('human') ? 'human' : 'bot',
    position: { x: 12.345678, y: -45.678901 },
    velocity: { x: 1.23456, y: -0.98765 },
    angle: 1.23456789,
    exploding: false,
    thrusting: true,
    color: '#5EEAD4',
    lives: 3,
    score: 150,
    health: 100,
    maxHealth: 100,
    ...overrides,
  };
}

function roid(id: string, x: number, y: number): AsteroidData {
  return {
    id,
    position: { x, y },
    velocity: { x: 1.23456789, y: -2.3456789 },
    size: 18.123456,
    jaggedness: 0.723456789,
    rotation: 2.718281828,
    angularVelocity: 0.003456789,
    health: 42,
    maxHealth: 42,
    vertices: 8,
    offsets: [1.123456, 0.987654, 1.234567, 0.876543, 1.111111, 0.999999, 1.010101, 0.888888],
  };
}

function fieldOf20(): AsteroidData[] {
  return Array.from({ length: 20 }, (_, i) =>
    roid(`server-asteroid-${i}`, 100.123456 + i * 13.789, -50.987654 + i * 7.123)
  );
}

test('quantizeNumber is stable so every client sees the same field', () => {
  expect(quantizeNumber(123.456789, 1)).toBe(123.5);
  expect(quantizeNumber(123.456789, 1)).toBe(quantizeNumber(123.456789, 1));
});

test('a full keyframe includes shape; the next delta omits unchanged asteroid fields', () => {
  const raw = {
    entities: [ship('human-1'), ship('bot-1', { position: { x: 3.21, y: 4.56 } })],
    asteroids: fieldOf20(),
    gameTime: 10,
    isPaused: false,
  };

  const first = encodeGameStateSnapshot(raw, null, { full: true });
  expect(first.wire.full).toBe(true);
  expect(first.wire.asteroids[0]).toMatchObject({
    id: 'server-asteroid-0',
    vertices: 8,
  });
  expect((first.wire.asteroids[0] as AsteroidData).offsets).toHaveLength(8);

  const moved = {
    ...raw,
    gameTime: 11,
    asteroids: raw.asteroids.map((asteroid) => ({
      ...asteroid,
      position: { x: asteroid.position.x + 1.11, y: asteroid.position.y },
      rotation: asteroid.rotation + 0.01,
    })),
    entities: raw.entities.map((entity) => ({
      ...entity,
      position: { x: entity.position.x + 0.4, y: entity.position.y },
    })),
  };

  const delta = encodeGameStateSnapshot(moved, first.baseline);
  expect(delta.wire.full).toBeUndefined();
  const firstRoid = delta.wire.asteroids[0];
  expect(firstRoid).toBeDefined();
  expect(firstRoid?.offsets).toBeUndefined();
  expect(firstRoid?.vertices).toBeUndefined();
  expect(firstRoid?.jaggedness).toBeUndefined();
  expect(firstRoid?.size).toBeUndefined();
  expect(firstRoid?.velocity).toBeUndefined();
  expect(firstRoid?.angularVelocity).toBeUndefined();
  expect(firstRoid?.health).toBeUndefined();
  expect(firstRoid?.position).toBeDefined();
  expect(firstRoid?.rotation).toBeDefined();

  const firstShip = delta.wire.entities.find((entity) => entity.id === 'human-1');
  expect(firstShip?.name).toBeUndefined();
  expect(firstShip?.type).toBeUndefined();
  expect(firstShip?.color).toBeUndefined();
  expect(firstShip?.maxHealth).toBeUndefined();
  expect(firstShip?.position).toBeDefined();
});

test('merging a delta onto a keyframe keeps shared pose and original shape', () => {
  const raw = {
    entities: [ship('human-1')],
    asteroids: [roid('server-asteroid-0', 10.15, 20.25)],
    gameTime: 1,
    isPaused: false,
  };
  const keyframe = encodeGameStateSnapshot(raw, null, { full: true });
  const moved = {
    ...raw,
    gameTime: 2,
    asteroids: [
      {
        ...raw.asteroids[0]!,
        position: { x: 80.44, y: -12.19 },
        rotation: 1.2349,
      },
    ],
  };
  const delta = encodeGameStateSnapshot(moved, keyframe.baseline);
  const merged = mergeWireGameState(
    {
      entities: keyframe.baseline.entities,
      asteroids: keyframe.baseline.asteroids,
      gameTime: keyframe.baseline.gameTime,
      isPaused: keyframe.baseline.isPaused,
    },
    delta.wire
  );

  expect(merged.asteroids[0]?.offsets).toEqual(keyframe.baseline.asteroids[0]?.offsets);
  expect(merged.asteroids[0]?.vertices).toBe(8);
  expect(merged.asteroids[0]?.position).toEqual(delta.wire.asteroids[0]?.position);
  expect(merged.asteroids[0]?.position).toEqual(quantizeAsteroid(moved.asteroids[0]!).position);
});

test('a 20-asteroid moving field plus two ships shrinks on the wire', () => {
  const raw = {
    entities: [ship('human-1'), ship('bot-1', { color: '#FB923C', type: 'bot' as const })],
    asteroids: fieldOf20(),
    gameTime: 100,
    isPaused: false,
  };
  const naive = jsonUtf8Bytes({ type: 'gameState', data: raw, timestamp: 1 });
  const keyframe = encodeGameStateSnapshot(raw, null, { full: true });
  const moved = {
    ...raw,
    gameTime: 101,
    asteroids: raw.asteroids.map((asteroid) => ({
      ...asteroid,
      position: { x: asteroid.position.x + 2.2, y: asteroid.position.y - 1.1 },
      rotation: asteroid.rotation + 0.02,
    })),
    entities: raw.entities.map((entity) => ({
      ...entity,
      position: { x: entity.position.x + 1.5, y: entity.position.y },
      angle: entity.angle + 0.05,
    })),
  };
  const delta = encodeGameStateSnapshot(moved, keyframe.baseline);
  const deltaBytes = jsonUtf8Bytes({ type: 'gameState', data: delta.wire, timestamp: 1 });
  const keyframeBytes = jsonUtf8Bytes({ type: 'gameState', data: keyframe.wire, timestamp: 1 });

  expect(keyframeBytes).toBeLessThan(naive);
  expect(deltaBytes).toBeLessThan(naive * 0.4);
  expect(deltaBytes).toBeLessThan(keyframeBytes * 0.55);
  expect(delta.wire.asteroids).toHaveLength(20);
  expect(delta.wire.entities).toHaveLength(2);
});

test('encode does not mutate the live server asteroid objects', () => {
  const asteroid = roid('server-asteroid-0', 1.23456789, 2.3456789);
  const originalX = asteroid.position.x;
  const originalOffset = asteroid.offsets[0];
  encodeGameStateSnapshot(
    { entities: [], asteroids: [asteroid], gameTime: 0, isPaused: false },
    null,
    { full: true }
  );
  expect(asteroid.position.x).toBe(originalX);
  expect(asteroid.offsets[0]).toBe(originalOffset);
});
