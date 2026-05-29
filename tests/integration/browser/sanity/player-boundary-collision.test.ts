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
  console.log('🧹 Cleared screenshots directory');
  
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

// Scenario: a player that crosses the circular world boundary is destroyed,
// loses a life, and respawns back inside the playfield.
test('player explodes when hitting boundary', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  await game.waitForGameReady();

  const initialLives = await game.getLives();
  expect(initialLives).toBe(3);

  // Wait out spawn protection so the boundary hit is fatal immediately.
  await game.waitForCombatReady();

  // Place the ship just outside the circular boundary (radius 3100). The
  // client's boundary check should detect this and report a fatal hit.
  await game.placeShipAt(3150, 0);

  // The player loses a life from the boundary collision.
  await expect
    .poll(() => game.getLives(), { timeout: 8000, message: 'crossing the boundary should cost a life' })
    .toBeLessThan(initialLives);

  // After the death/respawn cycle the player is returned inside the boundary
  // (a respawn places them within 80% of the radius) and is alive again.
  await expect
    .poll(() => game.getShipDistanceFromCenter(), {
      timeout: 12000,
      message: 'player should respawn inside the boundary',
    })
    .toBeLessThan(3100);

  await expect
    .poll(() => game.getShipHealth(), { timeout: 12000, message: 'player should respawn with health' })
    .toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT);
