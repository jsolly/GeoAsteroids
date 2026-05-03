import { expect, test, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { ScreenshotManager } from '../../utils/screenshot-manager';
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

test('small roids do not split', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const gameInteractions = new GameInteractions(page);

  await gameInteractions.navigateToGame();
  await gameInteractions.waitForGameToLoad();

  // Enable debug settings to create small roids (disable ALL_LARGE)
  await gameInteractions.enableDebugSettings({
    PLACE_ON_LOCAL_PLAYER: true,
    INITIAL_COUNT: 3,
    ALL_LARGE: false, // This should create small roids
  });

  await gameInteractions.waitForAsteroids(3);

  const initialCount = await gameInteractions.getAsteroidCount();

  // Collide with small roids
  await gameInteractions.moveShipToAsteroids();
  
  // Wait for asteroid destruction (no splitting should occur)
  await gameInteractions.waitForAsteroidDestruction();

  // Check that count decreased (no splitting)
  const finalCount = await gameInteractions.getAsteroidCount();
  expect(finalCount).toBeLessThan(initialCount);
}, TestConfig.DEFAULT_TIMEOUT);
