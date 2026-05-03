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

test('large roids split into medium roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const gameInteractions = new GameInteractions(page);

  await gameInteractions.navigateToGame();
  await gameInteractions.waitForGameToLoad();

  // Enable debug settings with large roids
  await gameInteractions.enableDebugSettings({
    PLACE_ON_LOCAL_PLAYER: true,
    INITIAL_COUNT: 3,
  });

  await gameInteractions.waitForAsteroids(3);

  // Get initial asteroid sizes
  const initialSizes = await gameInteractions.getAsteroidSizes();
  const largeRoids = initialSizes.filter(size => size >= 20);
  expect(largeRoids.length).toBeGreaterThan(0);

  const initialCount = await gameInteractions.getAsteroidCount();

  // Collide with large roids
  await gameInteractions.moveShipToAsteroids();
  
  // Wait for asteroid count to change due to splitting
  await gameInteractions.waitForAsteroidCountChange(initialCount);

  // Check that we now have more asteroids due to splitting
  const finalCount = await gameInteractions.getAsteroidCount();
  expect(finalCount).toBeGreaterThan(initialCount);
}, TestConfig.DEFAULT_TIMEOUT);
