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

test('debug small roids creation', async () => {
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

  // Wait for asteroids to be created (server initializes asteroids after player joins)
  // Server creates 10 asteroids by default, not 3
  await gameInteractions.waitForAsteroids(10);

  const asteroidCount = await gameInteractions.getAsteroidCount();
  console.log(`🔍 Asteroid count: ${asteroidCount}`);

  // Check if we have asteroids
  expect(asteroidCount).toBeGreaterThan(0);

  // Get asteroid details
  const asteroidDetails = await page.evaluate(() => {
    const gameController = (window as any).gameController;
    if (gameController?.roidBelt?.asteroids) {
      return Array.from(gameController.roidBelt.asteroids.values()).map((roid: any) => ({
        id: roid.id,
        size: roid.size,
        health: roid.health,
        maxHealth: roid.maxHealth
      }));
    }
    return [];
  });

  console.log('🔍 Asteroid details:', asteroidDetails);

  // Check that all asteroids are small (size < 25)
  asteroidDetails.forEach((asteroid, index) => {
    console.log(`Asteroid ${index + 1}: size=${asteroid.size}, health=${asteroid.health}/${asteroid.maxHealth}`);
    expect(asteroid.size).toBeLessThan(25);
  });

}, TestConfig.DEFAULT_TIMEOUT);
