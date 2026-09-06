import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

// Scenario: shooting a large asteroid breaks it into two medium fragments.
test('large roids split into medium roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.bootGame();
  await game.waitForAsteroids(1, 30000);

  const asteroids = await game.getAsteroidPositions();
  const initialCount = asteroids.length;

  // The default field is all large asteroids (r≈50).
  const large = asteroids.find((a) => a.radius >= 40);
  expect(large, 'expected at least one large asteroid in the field').toBeTruthy();
  if (!large) return;

  await game.destroyAsteroidWithLaser(large);

  // Splitting yields a net +1 asteroid (one destroyed, two created).
  await expect
    .poll(() => game.getAsteroidCount(), { timeout: 8000, message: 'large asteroid should split into more pieces' })
    .toBeGreaterThan(initialCount);

  // The new fragments are medium-sized — smaller than the large original,
  // but still large enough to split again later.
  const sizes = await game.getAsteroidSizes();
  const mediumFragments = sizes.filter((r) => r >= 25 && r < large.radius);
  expect(mediumFragments.length, 'expected medium-sized fragments after the split').toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT);
