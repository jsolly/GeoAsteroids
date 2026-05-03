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

test('scoring works correctly for different roid sizes', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const gameInteractions = new GameInteractions(page);

  await gameInteractions.navigateToGame();
  await gameInteractions.waitForGameToLoad();

  const initialScore = await gameInteractions.getPlayerScore();

  // Enable debug settings
  await gameInteractions.enableDebugSettings({
    PLACE_ON_LOCAL_PLAYER: true,
    INITIAL_COUNT: 3,
  });

  await gameInteractions.waitForAsteroids(3);

  // Collide with asteroids
  await gameInteractions.moveShipToAsteroids();
  await gameInteractions.waitForAsteroidSplitting();

  // Check that score increased
  const finalScore = await gameInteractions.getPlayerScore();
  expect(finalScore).toBeGreaterThan(initialScore);
}, TestConfig.DEFAULT_TIMEOUT);
