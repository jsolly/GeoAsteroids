import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('laser hits and destroys asteroids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();
  await game.waitForAsteroids(1);

  const initialScore = await game.getScore();
  const initialCount = await game.getAsteroidCount();
  const target = (await game.getAsteroidDetails())[0];

  await game.destroyAsteroidWithLaser(target, 25000);

  await expect
    .poll(() => game.getAsteroidCount(), { timeout: 8000, message: 'asteroid should be destroyed' })
    .toBeLessThan(initialCount);
  await expect
    .poll(() => game.getScore(), { timeout: 8000, message: 'destroying an asteroid should award points' })
    .toBeGreaterThan(initialScore);
}, TestConfig.DEFAULT_TIMEOUT);
