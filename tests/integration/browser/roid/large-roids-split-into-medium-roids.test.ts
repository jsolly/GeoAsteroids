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

// Scenario: shooting a large asteroid breaks it into two medium fragments.
test('large roids split into medium roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();
  await game.waitForAsteroids(1);

  const asteroids = await game.getAsteroidPositions();
  const initialCount = asteroids.length;

  // The default field is all large asteroids (r≈50).
  const large = asteroids.find((a) => a.radius >= 40);
  expect(large, 'expected at least one large asteroid in the field').toBeTruthy();
  if (!large) return;

  await game.destroyAsteroidWithLaser(large);

  // Splitting yields a net +1 asteroid (one destroyed, two created).
  await expect
    .poll(() => game.getAsteroidCount(), { timeout: 8000, message: 'large asteroid should split into more pieces' })
    .toBeGreaterThan(initialCount);

  // The new fragments are medium-sized — smaller than the large original,
  // but still large enough to split again later.
  const sizes = await game.getAsteroidSizes();
  const mediumFragments = sizes.filter((r) => r >= 25 && r < large.radius);
  expect(mediumFragments.length, 'expected medium-sized fragments after the split').toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT);
