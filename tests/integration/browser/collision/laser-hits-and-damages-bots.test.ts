import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

// Scenario: a player's lasers that strike a bot reduce the bot's health.
test('laser hits and damages bots', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  await game.waitForGameReady();
  await game.verifyGameCanvas();

  // Find a bot and fire on it at close range.
  await game.waitForBots(1);
  const target = (await game.getBots())[0];
  expect(target).toBeTruthy();

  const result = await game.attackBotWithLasers(target.id, 10);

  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('laser-bot-collision-test')
  );
  await page.screenshot({ path: screenshotPath });

  // The bot's health dropped below full as a direct result of being shot.
  expect(result.minHealthObserved, 'laser fire should damage the bot').toBeLessThan(100);
}, TestConfig.DEFAULT_TIMEOUT);
