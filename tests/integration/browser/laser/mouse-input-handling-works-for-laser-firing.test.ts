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

// Test: Mouse input handling works correctly
test('mouse input handling works for laser firing', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Set up message tracking
  const mouseMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('MOUSE') || text.includes('mouse')) {
      mouseMessages.push(text);
    }
  });
  
  // Navigate and start the game
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Wait for initialization
  await page.waitForTimeout(2000);
  
  // Test mouse clicks
  console.log('🖱️ Testing mouse input handling...');
  await game.fireLasersWithMouse(2, 1000);
  
  // Wait for processing
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('mouse-input-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // Check for mouse messages
  console.log('📝 Mouse messages:', mouseMessages);
  
  // Verify that mouse events were captured
  const mouseClickMessages = mouseMessages.filter(msg => 
    msg.includes('Mouse down event') ||
    msg.includes('Left mouse click - shooting')
  );
  
  expect(mouseClickMessages.length).toBeGreaterThan(0);
  console.log('✅ Mouse input handling is working correctly');
}, TestConfig.DEFAULT_TIMEOUT);
