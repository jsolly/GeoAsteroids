import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('second player sees shared asteroid field', async () => {
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');

  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');

  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);

  await game1.bootSinglePlayerGame();
  await game1.waitForAsteroids(1);
  const count1 = await game1.getAsteroidCount();

  await game2.bootSinglePlayerGame();
  await game2.waitForAsteroids(1);
  const count2 = await game2.getAsteroidCount();

  expect(count1).toBeGreaterThan(0);
  expect(Math.abs(count1 - count2)).toBeLessThanOrEqual(2);

  await expect
    .poll(() => game1.getAllPlayerCount(), { timeout: 10000, message: 'both players should see each other' })
    .toBeGreaterThanOrEqual(2);
}, TestConfig.DEFAULT_TIMEOUT * 2);
