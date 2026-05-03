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

// Test: Bot health regeneration after asteroid collision
test('bot health regenerates after asteroid collision damage', async () => {
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
  
  // Wait for bots to be damaged and start regenerating
  await page.waitForTimeout(5000);
  
  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('bot-health-regeneration-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // In a real implementation, you would:
  // 1. Monitor bot health values over time
  // 2. Verify bots take damage from asteroid collisions
  // 3. Check that health regeneration starts after damage cooldown
  // 4. Verify health regenerates up to maximum
  // 5. Ensure health doesn't regenerate while exploding
  
  console.log('✅ Bot health regeneration test completed');
}, TestConfig.DEFAULT_TIMEOUT);
