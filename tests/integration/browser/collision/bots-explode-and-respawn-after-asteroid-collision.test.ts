import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('bots explode and respawn after asteroid collision', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForBots(1);

  const bot = (await game.getBots())[0]!;
  const deathPosition = { x: bot.x, y: bot.y };

  await game.damageBot(bot.id, 100, 'asteroid-collision');

  await expect
    .poll(() => game.getBots().then((b) => b.find((x) => x.id === bot.id)?.health ?? 0), {
      timeout: 8000,
      message: 'bot should be destroyed by asteroid collision damage',
    })
    .toBeLessThanOrEqual(0);

  const respawnPosition = await game.waitForBotRespawn(bot.id);
  expect(respawnPosition.x !== deathPosition.x || respawnPosition.y !== deathPosition.y).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
