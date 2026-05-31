import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

// Scenario: a small asteroid is destroyed outright — it does NOT split into
// even smaller pieces (unlike large and medium asteroids).
test('small roids do not split', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();
  await game.waitForAsteroids(1);

  // Break a large asteroid (→ mediums), then a medium (→ smalls).
  const large = (await game.getAsteroidPositions()).find((a) => a.radius >= 40);
  expect(large).toBeTruthy();
  if (!large) return;
  await game.destroyAsteroidWithLaser(large);

  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.radius >= 25 && a.radius < 40), {
      timeout: 8000,
    })
    .toBe(true);
  const medium = (await game.getAsteroidPositions()).find((a) => a.radius >= 25 && a.radius < 40);
  expect(medium).toBeTruthy();
  if (!medium) return;
  await game.destroyAsteroidWithLaser(medium);

  // A small fragment (r < 25) now exists and is below the split threshold.
  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.radius < 25), { timeout: 8000 })
    .toBe(true);
  const small = (await game.getAsteroidPositions()).find((a) => a.radius < 25);
  expect(small).toBeTruthy();
  if (!small) return;

  // Wait out spawn protection so the collision actually destroys the small roid.
  await game.waitForCombatReady();

  const countBeforeSmallDestroy = await game.getAsteroidCount();

  // Destroying the small asteroid removes it WITHOUT creating new fragments,
  // so the total count strictly decreases (a split would have increased it).
  await game.collideShipWithAsteroid(small);

  await expect
    .poll(() => game.getAsteroidCount(), {
      timeout: 8000,
      message: 'destroying a small asteroid should reduce the count (no split)',
    })
    .toBeLessThan(countBeforeSmallDestroy);
}, TestConfig.DEFAULT_TIMEOUT);
