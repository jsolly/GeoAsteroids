import { expect, test, vi } from 'vitest';
import { ROID_NUM } from '../src/constants/game';
import { createRoidBelt, Roid } from '../src/entities/roid/Roid';

test('Roid Creation', () => {
  const roidPoint = { x: 10, y: 20 };
  const roidRadius = 10;
  const newRoid = new Roid(roidPoint, roidRadius);
  expect(newRoid).toBeInstanceOf(Roid);
});

test('Roid Belt Creation', () => {
  const testRoidBelt = createRoidBelt();
  expect(testRoidBelt).toBeInstanceOf(testRoidBelt.constructor);
  expect(testRoidBelt.roids.length).toEqual(ROID_NUM);
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
  // Mock debug environment to ensure roid movement works
  vi.stubEnv('VITE_CLIENT_LOG_LEVEL', 'info');

  const testRoidBelt = createRoidBelt();
  testRoidBelt.addRoid();
  const firstRoid = testRoidBelt.roids[0];

  // Set deterministic velocity to ensure movement test is reliable
  firstRoid.velocity = { x: 1, y: 0 }; // Move right at 1 unit per frame

  const previousX = firstRoid.position.x;
  testRoidBelt.moveRoids();
  expect(firstRoid.position.x).not.toEqual(previousX);

  // Restore environment
  vi.unstubAllEnvs();
});

// Debug functionality is tested separately in the debug system
// since it's completely decoupled from the main roid logic
