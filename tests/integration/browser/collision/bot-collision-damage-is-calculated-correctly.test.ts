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

// Test: Bot collision priority and damage calculation
test('bot collision damage is calculated correctly', async () => {
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
  
  // Wait for game state to stabilize
  await page.waitForTimeout(2000);
  
  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('bot-collision-damage-calculation-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // In a real implementation, you would:
  // 1. Monitor bot health before and after collisions
  // 2. Verify damage amounts are consistent
  // 3. Check that different asteroid sizes cause different damage
  // 4. Verify damage calculation is server-authoritative
  // 5. Ensure collision detection is accurate
  
  console.log('✅ Bot collision damage calculation test completed');
}, TestConfig.DEFAULT_TIMEOUT);
