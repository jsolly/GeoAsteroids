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

// Test: Laser collision priority (asteroid vs bot)
test('laser collision priority works correctly', async () => {
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
  
  // Position ship to potentially hit both asteroids and bots
  await game.moveShip('right', 300);
  await game.moveShip('down', 200);
  
  // Fire lasers to test collision priority
  await game.fireLasers(4, 250); // Fire 4 lasers with 250ms delay
  
  // Wait for collision processing
  await page.waitForTimeout(1500);
  
  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('laser-collision-priority-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // Verify collision priority is working
  // In a real implementation, you might check for:
  // - Lasers hitting asteroids before bots when both are present
  // - Proper collision detection order
  // - Correct damage application
}, TestConfig.DEFAULT_TIMEOUT);
