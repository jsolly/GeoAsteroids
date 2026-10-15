// @vitest-environment node
import { expect, test } from 'vitest';
import { runCodecSample } from '../../../benchmarks/codec';
import { assertSelectedSnapshotState } from '../../../benchmarks/snapshot-state';
import { snapshotFixture } from '../network/snapshotFixture';

test('benchmark validation rejects incomplete or incorrectly rounded worlds without changing the source', () => {
  const source = snapshotFixture(0);
  const asteroid = source.asteroids[0];
  const pilot = source.entities[0];
  expect(asteroid).toBeDefined();
  expect(pilot).toBeDefined();
  if (!asteroid || !pilot) {
    throw new Error('Missing declared fixture participants');
  }
  asteroid.position.x = 1.234567;
  pilot.position.x = 9.876543;
  const original = structuredClone(source);
  const selected = structuredClone(source);
  const selectedAsteroid = selected.asteroids[0];
  if (!selectedAsteroid) {
    throw new Error('Missing selected asteroid');
  }
  selectedAsteroid.position.x = 1.2346;
  expect(() => assertSelectedSnapshotState(selected, source)).not.toThrow();
  expect(() => assertSelectedSnapshotState(source, source)).toThrow('selected-precision state');

  const missing = structuredClone(selected);
  Reflect.deleteProperty(missing, 'playerProjectiles');
  expect(() => assertSelectedSnapshotState(missing, source)).toThrow('selected-precision state');
  const changedPilot = structuredClone(selected);
  const changed = changedPilot.entities[0];
  if (!changed) {
    throw new Error('Missing changed pilot');
  }
  changed.position.x = 9.8765;
  expect(() => assertSelectedSnapshotState(changedPilot, source)).toThrow(
    'selected-precision state'
  );
  expect(source).toEqual(original);
});

test('codec samples qualify complete selected-precision worlds for shared and staggered recipients', () => {
  const result = runCodecSample({
    seed: 0,
    warmupTicks: 1,
    measuredTicks: 6,
    recipientCounts: [1, 2],
  });

  expect(result.cleanup).toBe('complete');
  expect(result.counts).toMatchObject({
    warmupTicks: 1,
    measuredTicks: 6,
    'shared-recipients-1-messages': 6,
    'shared-recipients-1-decoded-messages': 6,
    'shared-recipients-2-messages': 12,
    'shared-recipients-2-decoded-messages': 12,
    'staggered-recipients-1-messages': 5,
    'staggered-recipients-1-decoded-messages': 5,
    'staggered-recipients-2-messages': 10,
    'staggered-recipients-2-decoded-messages': 10,
  });
  expect(result.witness).toMatchObject({
    before: {
      fixtureKeys: [
        'asteroids',
        'beltRecovery',
        'civicModules',
        'entities',
        'exploration',
        'gameTime',
        'isPaused',
        'loot',
        'mapAssets',
        'playerProjectiles',
        'satellitePickups',
        'serverTime',
        'settlement',
        'spiderField',
        'terrainSeed',
      ],
      firstWorld: {
        serverTime: 0,
        civicModules: [],
        spiderField: { spiders: [], nests: [] },
        beltRecovery: [],
      },
    },
    after: {
      lastDecodedWorld: {
        serverTime: 0,
        civicModules: [],
        spiderField: { spiders: [], nests: [] },
        beltRecovery: [],
      },
      scenarios: [
        {
          pattern: 'shared',
          recipients: 1,
          finalSequences: [7],
          baselineDivergenceObserved: false,
        },
        {
          pattern: 'shared',
          recipients: 2,
          finalSequences: [7, 7],
          baselineDivergenceObserved: false,
        },
        {
          pattern: 'staggered',
          recipients: 1,
          finalSequences: [5],
          baselineDivergenceObserved: false,
        },
        {
          pattern: 'staggered',
          recipients: 2,
          finalSequences: [5, 6],
          baselineDivergenceObserved: true,
        },
      ],
    },
    stateContract: { originalInputsUnchanged: true },
  });
});
