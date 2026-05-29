import { test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { ScreenshotManager } from '../../utils/screenshot-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';
import { HealthChecker } from '../../utils/health-checker';

// Test infrastructure
const browserManager = new BrowserManager();
const screenshotManager = new ScreenshotManager(__dirname);

// Test setup and teardown
beforeAll(async () => {
  // Check if required servers are running before starting tests
  console.log('🔍 Checking server health...');
  
  try {
    await HealthChecker.checkAllServers();
    console.log('✅ All servers are healthy!');
  } catch (error) {
    console.error('❌ Server health check failed:', error);
    console.error('\n🚀 To run integration tests, start the servers first:');
    console.error('   npm run dev');
    console.error('\n   Then in another terminal, run:');
    console.error('   npm run test:integration');
    throw error;
  }
  
  // Clear screenshots before starting tests
  screenshotManager.clearScreenshots();
  
  // Initialize browser
  await browserManager.initialize();
});

afterAll(async () => {
  await browserManager.cleanup();
});

beforeEach(async () => {
  // Create a new page for each test
  await browserManager.createPage();
});

afterEach(async () => {
  // Close the current page
  await browserManager.closePage();
});

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
