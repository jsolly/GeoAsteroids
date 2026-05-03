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

test('collision detection works with multiple roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const gameInteractions = new GameInteractions(page);

  // Add console log listener to see what's happening BEFORE starting the game
  page.on('console', msg => {
    if (msg.type() === 'log' && (msg.text().includes('🔍') || msg.text().includes('SERVER') || msg.text().includes('asteroid') || msg.text().includes('NETWORK') || msg.text().includes('GAME_CONTROLLER') || msg.text().includes('CLIENT'))) {
      console.log('BROWSER:', msg.text());
    }
    if (msg.type() === 'error') {
      console.log('🚨 BROWSER ERROR:', msg.text());
    }
  });

  await gameInteractions.navigateToGame();
  console.log('🔍 Navigating to game completed');
  await gameInteractions.waitForGameToLoad();
  console.log('🔍 Game loaded, waiting for asteroids...');

  // Enable debug settings with many roids
  await gameInteractions.enableDebugSettings({
    PLACE_ON_LOCAL_PLAYER: true,
    INITIAL_COUNT: 10,
  });

  // Wait for asteroids to be created (server creates 20 by default)
  console.log('🔍 Waiting for 20 asteroids...');
  await gameInteractions.waitForAsteroids(20);
  console.log('✅ Found 20 asteroids');

  const initialCount = await gameInteractions.getAsteroidCount();

  // Get asteroid positions and sizes for debugging
  const asteroidPositions = await gameInteractions.getAsteroidPositions();
  const asteroidSizes = await gameInteractions.getAsteroidSizes();
  console.log('🔍 Initial asteroid positions:', asteroidPositions);
  console.log('🔍 Initial asteroid sizes:', asteroidSizes);

  // Get ship position before movement
  const shipPositionBefore = await gameInteractions.getShipPosition();
  console.log('🔍 Ship position before movement:', shipPositionBefore);

  // Move ship around extensively to increase collision chances
  console.log('🔍 Moving ship around to collide with asteroids...');
  await gameInteractions.moveShip('up', 1000);
  await gameInteractions.moveShip('down', 1000);
  await gameInteractions.moveShip('left', 1000);
  await gameInteractions.moveShip('right', 1000);
  await gameInteractions.moveShip('up', 1000);
  await gameInteractions.moveShip('down', 1000);
  await gameInteractions.moveShip('left', 1000);
  await gameInteractions.moveShip('right', 1000);

  // Get ship position after movement
  const shipPositionAfter = await gameInteractions.getShipPosition();
  console.log('🔍 Ship position after movement:', shipPositionAfter);

  // Wait a bit for any network messages to be processed
  await gameInteractions.waitForTimeout(2000);

  // Check asteroid count after movement
  const countAfterMovement = await gameInteractions.getAsteroidCount();
  console.log(`🔍 Asteroid count after movement: ${countAfterMovement} (initial: ${initialCount})`);

  // Wait for asteroid count to change due to splitting
  try {
    await gameInteractions.waitForAsteroidCountChange(initialCount, 5000);
  } catch (error) {
    console.log('⚠️ Asteroid count did not change, checking final count...');
  }

  // Check that we have more asteroids due to splitting
  const finalCount = await gameInteractions.getAsteroidCount();
  console.log(`🔍 Final asteroid count: ${finalCount} (initial: ${initialCount})`);
  expect(finalCount).toBeGreaterThan(initialCount);
}, TestConfig.DEFAULT_TIMEOUT);
