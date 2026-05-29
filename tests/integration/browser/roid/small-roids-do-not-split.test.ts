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

// Scenario: a small asteroid is destroyed outright — it does NOT split into
// even smaller pieces (unlike large and medium asteroids).
test('small roids do not split', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();
  await game.waitForAsteroids(1);

  // Break a large asteroid (→ mediums), then a medium (→ smalls).
  const large = (await game.getAsteroidPositions()).find((a) => a.radius >= 40);
  expect(large).toBeTruthy();
  if (!large) return;
  await game.destroyAsteroidWithLaser(large);

  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.radius >= 25 && a.radius < 40), {
      timeout: 8000,
    })
    .toBe(true);
  const medium = (await game.getAsteroidPositions()).find((a) => a.radius >= 25 && a.radius < 40);
  expect(medium).toBeTruthy();
  if (!medium) return;
  await game.destroyAsteroidWithLaser(medium);

  // A small fragment (r < 25) now exists and is below the split threshold.
  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.radius < 25), { timeout: 8000 })
    .toBe(true);
  const small = (await game.getAsteroidPositions()).find((a) => a.radius < 25);
  expect(small).toBeTruthy();
  if (!small) return;

  // Wait out spawn protection so the collision actually destroys the small roid.
  await game.waitForCombatReady();

  const countBeforeSmallDestroy = await game.getAsteroidCount();

  // Destroying the small asteroid removes it WITHOUT creating new fragments,
  // so the total count strictly decreases (a split would have increased it).
  await game.collideShipWithAsteroid(small);

  await expect
    .poll(() => game.getAsteroidCount(), {
      timeout: 8000,
      message: 'destroying a small asteroid should reduce the count (no split)',
    })
    .toBeLessThan(countBeforeSmallDestroy);
}, TestConfig.DEFAULT_TIMEOUT);
