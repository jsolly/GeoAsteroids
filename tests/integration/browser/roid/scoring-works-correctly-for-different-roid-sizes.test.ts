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

// Scenario: destroying asteroids of different sizes awards points, and the
// player's score climbs with each kill.
test('scoring works correctly for different roid sizes', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();
  await game.waitForAsteroids(2);

  const initialScore = await game.getScore();
  expect(initialScore).toBe(0);

  // Destroy a large asteroid — score must rise.
  const large = (await game.getAsteroidPositions()).find((a) => a.radius >= 40);
  expect(large).toBeTruthy();
  if (!large) return;
  await game.destroyAsteroidWithLaser(large);

  await expect
    .poll(() => game.getScore(), { timeout: 8000, message: 'score should increase after first kill' })
    .toBeGreaterThan(initialScore);

  const scoreAfterLarge = await game.getScore();

  // Destroy one of the resulting medium fragments — score must rise again.
  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.radius >= 25 && a.radius < 40), {
      timeout: 8000,
    })
    .toBe(true);
  const medium = (await game.getAsteroidPositions()).find((a) => a.radius >= 25 && a.radius < 40);
  expect(medium).toBeTruthy();
  if (!medium) return;
  await game.destroyAsteroidWithLaser(medium);

  await expect
    .poll(() => game.getScore(), { timeout: 8000, message: 'score should increase after second kill' })
    .toBeGreaterThan(scoreAfterLarge);
}, TestConfig.DEFAULT_TIMEOUT);
