import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('bots move and can encounter asteroids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame();
  await game.waitForBots(1, 25000);
  await game.waitForAsteroids(1);

  const start = await game.getBots();
  expect(start.length).toBeGreaterThan(0);

  await page.waitForTimeout(4000);

  const later = await game.getBots();
  const moved = later.some((bot, i) => {
    const s = start.find((b) => b.id === bot.id) ?? start[i];
    if (!s) return false;
    return Math.hypot(bot.x - s.x, bot.y - s.y) > 2;
  });

  expect(moved, 'bots should move around the arena').toBe(true);
  expect(await game.getAsteroidCount()).toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT);
