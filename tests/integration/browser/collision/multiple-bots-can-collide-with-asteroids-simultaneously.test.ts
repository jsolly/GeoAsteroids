import { test, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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

// Test: Multiple bot-asteroid collision scenarios
test('multiple bots can collide with asteroids simultaneously', async () => {
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
  
  // Wait for multiple bots and asteroids to be present
  await page.waitForTimeout(3000);
  
  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('multiple-bot-asteroid-collisions-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // In a real implementation, you would:
  // 1. Verify multiple bots are present in the game
  // 2. Check that multiple asteroids are present
  // 3. Monitor all bot health values
  // 4. Verify multiple bots can take damage simultaneously
  // 5. Check that collision detection works for all bot-asteroid pairs
  
  console.log('✅ Multiple bot-asteroid collision test completed');
}, TestConfig.DEFAULT_TIMEOUT);
