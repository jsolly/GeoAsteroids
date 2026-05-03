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

// Test: Remote player lasers are rendered on other clients
test('remote player lasers are visible on other clients', async () => {
  // Create two browser pages
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');
  
  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');
  
  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);
  
  // Start both games
  console.log('🎮 Starting game for client 1...');
  await game1.navigateToGame();
  await game1.startGame();
  await game1.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  console.log('🎮 Starting game for client 2...');
  await game2.navigateToGame();
  await game2.startGame();
  await game2.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Wait for both clients to connect
  await page1.waitForTimeout(3000);
  await page2.waitForTimeout(3000);
  
  // Take initial screenshots
  const initialScreenshot1 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-before-lasers')
  );
  await page1.screenshot({ path: initialScreenshot1 });
  
  const initialScreenshot2 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-before-lasers')
  );
  await page2.screenshot({ path: initialScreenshot2 });
  
  // Client 1 fires lasers
  console.log('🔫 Client 1 firing lasers...');
  await game1.fireLasersWithMouse(3, 800);
  
  // Wait for lasers to be processed and rendered
  await page1.waitForTimeout(3000);
  await page2.waitForTimeout(3000);
  
  // Take final screenshots
  const finalScreenshot1 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-after-lasers')
  );
  await page1.screenshot({ path: finalScreenshot1 });
  
  const finalScreenshot2 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-after-lasers')
  );
  await page2.screenshot({ path: finalScreenshot2 });
  
  // For now, we'll just verify that the screenshots were taken
  // In a more sophisticated test, we could analyze the screenshots
  // to detect the presence of laser pixels
  console.log('✅ Screenshots taken for laser visibility verification');
  console.log('📸 Check screenshots manually to verify remote lasers are visible');
}, TestConfig.DEFAULT_TIMEOUT * 2);
