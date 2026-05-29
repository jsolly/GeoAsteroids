import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('score persists after respawn', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();
  await game.waitForBots(1, 30000);

  const target = (await game.getBots())[0];
  await game.attackBotWithLasers(target.id, 12);

  await expect
    .poll(() => game.getScore(), { timeout: 12000, message: 'destroying a bot should award points' })
    .toBeGreaterThanOrEqual(50);

  const scoreBeforeDeath = await game.getScore();
  await game.dieOnceViaBoundary();

  await expect
    .poll(() => game.getScore(), { timeout: 8000, message: 'score should survive respawn' })
    .toBeGreaterThanOrEqual(scoreBeforeDeath);
}, TestConfig.DEFAULT_TIMEOUT);
