import { test, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from './utils/browser-manager';
import { ScreenshotManager } from './utils/screenshot-manager';
import { GameInteractions } from './utils/game-interactions';
import { TestConfig } from './utils/test-config';
import { HealthChecker } from './utils/health-checker';

// Test infrastructure
const browserManager = new BrowserManager();
const screenshotManager = new ScreenshotManager(__dirname);

// Test setup and teardown
beforeAll(async () => {
  // Check if required servers are running before starting tests
  // This will fail fast if the WebSocket server (/health) or Vite dev server isn't running
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

// Test: Basic game functionality
test('Game Initializes correctly', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Navigate and start the game
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Verify game elements
  await game.verifyGameCanvas();
  await game.verifyGameArea();
  
  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('game-initializes-correctly-test')
  );
  await page.screenshot({ path: screenshotPath });
}, TestConfig.DEFAULT_TIMEOUT);

test('local player can move ship', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);

  await game.moveShip('right', 100);

  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('move-ship-test')
  );
  await page.screenshot({ path: screenshotPath });
});

test('local player can shoot lasers', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);

  await game.fireLasers(TestConfig.DEFAULT_LASER_COUNT, TestConfig.LASER_DELAY);

  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('shoot-lasers-test')
  );
  await page.screenshot({ path: screenshotPath });
});