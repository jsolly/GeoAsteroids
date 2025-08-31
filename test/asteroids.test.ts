import { expect, test, vi } from 'vitest';
import { ROID } from '../src/constants';
import { createRoidBelt, Roid } from '../src/entities/roid/Roid';

// Mock the constants to ensure roid movement works in tests
vi.mock('../src/constants', async () => {
  const actual = await vi.importActual('../src/constants');
  return {
    ...actual,
    LOGGING: { GLOBAL_LOG_LEVEL: 'info' },
    DEBUG: {
      ENABLED: false,
      LOCAL_PLAYER_INVINCIBLE: false,
      BOT_COUNT: 1,
      DISABLE_BOT_MOVEMENT: false,
      DISABLE_BOT_LASERS: false,
      DISABLE_BOT_SPAWN_PROTECTION: false,
      ROID_COUNT: 100,
      DISABLE_ROID_MOVEMENT: false,
      PLACE_ROID_ON_BOT: false,
      PLACE_PLAYERS_NEAR_CENTER: true,
    },
  };
});

test('Roid Creation', () => {
  const roidPoint = { x: 10, y: 20 };
  const roidRadius = 10;
  const newRoid = new Roid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Roid);
});

test('Roid Belt Creation', () => {
  const testRoidBelt = createRoidBelt();
  expect(testRoidBelt).toBeInstanceOf(testRoidBelt.constructor);
  expect(testRoidBelt.roids.length).toEqual(ROID.INITIAL_COUNT);
});

test('Roid Belt Add Roid', () => {
  const testRoidBelt = createRoidBelt();
  const roidCount = testRoidBelt.roids.length;
  testRoidBelt.addRoid();
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1);
});

test('Roid Belt Spawn Roids', () => {
  const testRoidBelt = createRoidBelt();

  // Remove some roids to trigger spawning
  testRoidBelt.roids.splice(0, 8); // Remove 8 roids, leaving 2 (below minCount of 5)

  // Spawn roids multiple times to reach minCount
  for (let i = 0; i < 3 && testRoidBelt.roids.length < 5; i++) {
    testRoidBelt.spawnTimer = 180; // ROID_SPAWN_TIME
    testRoidBelt.spawnRoids();
  }

  // Should spawn enough to reach minCount (5)
  expect(testRoidBelt.roids.length).toEqual(5);
});

test('Destroy Roid', () => {
  const testRoidBelt = createRoidBelt();
  testRoidBelt.addRoid();
  const roidCount = testRoidBelt.roids.length;
  const result = testRoidBelt.destroyRoid(0);
  // Manually apply the destruction
  testRoidBelt.roids.splice(0, 1);
  testRoidBelt.roids.push(...result.newRoids);
  expect(testRoidBelt.roids.length).toEqual(roidCount + 1); // Roid splits in two
});

test('Move Roids', () => {
  const testRoidBelt = createRoidBelt();
  testRoidBelt.addRoid();
  const firstRoid = testRoidBelt.roids[0];

  // Set deterministic velocity to ensure movement test is reliable
  firstRoid.velocity = { x: 1, y: 0 }; // Move right at 1 unit per frame

  const previousX = firstRoid.position.x;
  testRoidBelt.moveRoids();
  expect(firstRoid.position.x).not.toEqual(previousX);
});

// Debug functionality is tested separately in the debug system
// since it's completely decoupled from the main roid logic
