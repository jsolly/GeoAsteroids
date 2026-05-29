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

// Scenario: a medium asteroid (produced by splitting a large one) itself
// splits into small fragments when destroyed.
test('medium roids split into small roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();
  await game.waitForAsteroids(1);

  // Step 1: break a large asteroid to produce medium fragments.
  const initial = await game.getAsteroidPositions();
  const large = initial.find((a) => a.radius >= 40);
  expect(large, 'expected a large asteroid to break first').toBeTruthy();
  if (!large) return;
  await game.destroyAsteroidWithLaser(large);

  // Step 2: find one of the resulting medium fragments (25 ≤ r < 40).
  await expect
    .poll(
      async () => (await game.getAsteroidPositions()).some((a) => a.radius >= 25 && a.radius < 40),
      { timeout: 8000, message: 'expected a medium fragment to exist' }
    )
    .toBe(true);

  const afterLarge = await game.getAsteroidPositions();
  const medium = afterLarge.find((a) => a.radius >= 25 && a.radius < 40);
  expect(medium).toBeTruthy();
  if (!medium) return;

  const countBeforeMediumSplit = afterLarge.length;

  // Step 3: destroy the medium fragment — it should split into small pieces.
  await game.destroyAsteroidWithLaser(medium);

  await expect
    .poll(() => game.getAsteroidCount(), {
      timeout: 8000,
      message: 'medium asteroid should split into more pieces',
    })
    .toBeGreaterThan(countBeforeMediumSplit);

  // The medium produced small fragments (r < 25).
  const sizes = await game.getAsteroidSizes();
  const smallFragments = sizes.filter((r) => r < 25);
  expect(smallFragments.length, 'expected small fragments after the medium split').toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT);
