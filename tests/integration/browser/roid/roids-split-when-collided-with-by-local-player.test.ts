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

// Scenario: A player flies into a large asteroid. The ship takes collision
// damage and the asteroid breaks apart into smaller fragments.
test('roids split when collided with by local player', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();

  // Wait for the server's asteroid field to arrive.
  await game.waitForAsteroids(1);
  const asteroids = await game.getAsteroidPositions();
  const initialCount = asteroids.length;
  expect(initialCount).toBeGreaterThan(0);

  // Target a large asteroid (the default field is all large, r≈50).
  const target = asteroids.find((a) => a.radius >= 40) ?? asteroids[0];

  // Wait out spawn protection so the collision actually deals damage.
  await game.waitForCombatReady();

  // Fly into it for a single collision, then peel away.
  await game.collideShipWithAsteroid(target);

  // The ship should have taken collision damage.
  await expect
    .poll(() => game.getShipHealth(), { timeout: 8000, message: 'ship should take collision damage' })
    .toBeLessThan(100);

  // Destroying the large asteroid awards points to the player.
  await expect
    .poll(() => game.getScore(), { timeout: 8000, message: 'score should increase from destroying the asteroid' })
    .toBeGreaterThan(0);

  // The asteroid split into more pieces than we started with.
  await expect
    .poll(() => game.getAsteroidCount(), { timeout: 8000, message: 'asteroid should split into more pieces' })
    .toBeGreaterThan(initialCount);
}, TestConfig.DEFAULT_TIMEOUT);
