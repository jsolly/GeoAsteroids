import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('player takes damage from bot collision', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();
  await game.waitForBots(1);

  const bot = (await game.getBots())[0]!;
  const startHealth = await game.getShipHealth();

  await game.pinShipOnBot(bot.id, 3000);

  await expect
    .poll(() => game.getShipHealth(), {
      timeout: 8000,
      message: 'ramming a bot should deal collision damage',
    })
    .toBeLessThan(startHealth);
}, TestConfig.DEFAULT_TIMEOUT);
