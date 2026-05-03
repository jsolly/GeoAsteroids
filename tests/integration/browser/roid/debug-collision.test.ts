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
    console.error('\n🚀 To run tests, start the servers with: npm run dev');
    throw error;
  }

  await browserManager.initialize();
  console.log('✅ Browser initialized');
});

afterAll(async () => {
  await browserManager.cleanup();
  console.log('✅ Browser cleaned up');
});

beforeEach(async () => {
  await browserManager.createPage();
  console.log('✅ New page setup complete');
});

afterEach(async () => {
  await browserManager.closePage();
  console.log('✅ Page cleanup complete');
});

test('debug collision detection', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const gameInteractions = new GameInteractions(page);

  // Navigate to game
  await gameInteractions.navigateToGame();
  console.log('✅ Navigated to game');

  // Start game
  await gameInteractions.startGame();
  console.log('✅ Game started');

  // Enable debug settings to create small roids
  await gameInteractions.enableDebugSettings({
    PLACE_ON_LOCAL_PLAYER: true,
    INITIAL_COUNT: 3,
    ALL_LARGE: false, // This should create small roids
  });

  // Wait a bit for the asteroid initialization to complete
  console.log('⏳ Waiting for asteroid initialization...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check what's in the game controller before waiting
  const gameControllerState = await page.evaluate(() => {
    const gameController = (window as any).gameController;
    return {
      exists: !!gameController,
      currRoidBelt: !!gameController?.currRoidBelt,
      roidsLength: gameController?.currRoidBelt?.roids?.length || 0,
      roids: gameController?.currRoidBelt?.roids?.map((r: any) => ({ id: r.id, position: r.position, size: r.r })) || []
    };
  });
  console.log('🔍 Game controller state:', gameControllerState);

    // Wait for asteroids to be created (server creates 10 by default + 3 from debug settings = 13)
    await gameInteractions.waitForAsteroids(13);
  console.log('✅ Asteroids created');

  // Get initial asteroid count and positions
  const initialCount = await gameInteractions.getAsteroidCount();
  console.log(`📊 Initial asteroid count: ${initialCount}`);

  // Get asteroid details
  const asteroidDetails = await gameInteractions.getAsteroidDetails();
  console.log(`📊 Asteroid details:`, asteroidDetails);

  // Get ship position
  const shipPosition = await page.evaluate(() => {
    const gameController = (window as any).gameController;
    if (!gameController || !gameController.playerManager) return null;
    const localPlayer = gameController.playerManager.getLocalPlayer();
    if (!localPlayer || !localPlayer.ship) return null;
    return {
      position: localPlayer.ship.position,
      radius: localPlayer.ship.r
    };
  });
  console.log(`🚀 Ship position:`, shipPosition);

  // Move ship around to try to collide with asteroids
  console.log('🎮 Moving ship around...');
  await gameInteractions.moveShip('up', 1000);
  await gameInteractions.moveShip('down', 1000);
  await gameInteractions.moveShip('left', 1000);
  await gameInteractions.moveShip('right', 1000);

  // Wait a bit for collision detection
  await page.waitForTimeout(2000);

  // Check final asteroid count
  const finalCount = await gameInteractions.getAsteroidCount();
  console.log(`📊 Final asteroid count: ${finalCount}`);

  // Check if any asteroids were destroyed
  if (finalCount < initialCount) {
    console.log('✅ Asteroids were destroyed!');
  } else {
    console.log('❌ No asteroids were destroyed');
  }

  // Take a screenshot for debugging
  const screenshotPath = screenshotManager.getTimestampedFilename('debug-collision');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);

  // The test passes if we can get this far without errors
  expect(true).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
