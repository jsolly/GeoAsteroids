import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('kill message appears when player destroys bot', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForBots(1);

  const target = (await game.getBots())[0]!;
  await game.attackBotWithLasers(target.id, 12);

  await expect
    .poll(() => game.getKillMessage(), { timeout: 8000, message: 'kill banner should appear' })
    .toMatch(/You killed/i);
}, TestConfig.DEFAULT_TIMEOUT);
