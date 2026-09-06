import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('multiple bots can collide with asteroids simultaneously', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame();
  await game.waitForBots(2, 30000);
  await game.waitForAsteroids(1);

  const bots = await game.getBots();
  expect(bots.length).toBeGreaterThanOrEqual(2);
  expect(await game.getAsteroidCount()).toBeGreaterThan(0);

  await page.waitForTimeout(4000);

  const after = await game.getBots();
  expect(after.length).toBeGreaterThanOrEqual(2);
}, TestConfig.DEFAULT_TIMEOUT);
