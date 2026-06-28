import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('bot collision damage is calculated correctly', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForBots(1);

  const bot = (await game.getBots())[0]!;
  expect(bot.health).toBe(100);

  await game.damageBot(bot.id, 25, 'asteroid-collision');

  await expect
    .poll(() => game.getBots().then((b) => b.find((x) => x.id === bot.id)?.health ?? 100), {
      timeout: 5000,
      message: 'asteroid collision should deal 25 damage',
    })
    .toBe(75);
}, TestConfig.DEFAULT_TIMEOUT);
