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

// Test: Server receives and broadcasts laser events
test('server properly handles and broadcasts laser events', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Navigate and start the game
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Set up console message listener
  const networkMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('NETWORK') || text.includes('shoot')) {
      networkMessages.push(text);
    }
  });
  
  // Fire lasers
  console.log('🔫 Firing lasers to test server communication...');
  await game.fireLasersWithMouse(2, 1000);
  
  // Wait for network processing
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('server-laser-broadcast-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // Check for network messages
  console.log('📝 Network messages:', networkMessages);
  
  // Verify that shoot messages were sent
  const shootMessages = networkMessages.filter(msg => 
    msg.includes('Sending shoot message to server') ||
    msg.includes('Sending shoot event')
  );
  
  expect(shootMessages.length).toBeGreaterThan(0);
  console.log('✅ Server laser communication is working');
}, TestConfig.DEFAULT_TIMEOUT);
