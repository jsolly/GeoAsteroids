import { expect, test, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { ScreenshotManager } from '../../utils/screenshot-manager';
import { TestConfig } from '../../utils/test-config';
import { HealthChecker } from '../../utils/health-checker';

// Test infrastructure
const browserManager = new BrowserManager();
const screenshotManager = new ScreenshotManager(__dirname);

beforeAll(async () => {
  await HealthChecker.checkAllServers();
  screenshotManager.clearScreenshots();
  await browserManager.initialize();
});

afterAll(async () => {
  await browserManager.cleanup();
});

beforeEach(async () => {
  await browserManager.createPage();
});

afterEach(async () => {
  await browserManager.closePage();
});

// Scenario: with a full field of asteroids present, the player can pick one
// out and collide with it — collision detection registers the hit (the ship is
// damaged and the asteroid is destroyed) without disturbing the rest.
test('collision detection works with multiple roids', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.waitForGameToLoad();
  await game.waitForGameReady();

  // The server seeds a full field (20 asteroids by default).
  await game.waitForAsteroids(5);
  const asteroids = await game.getAsteroidPositions();
  expect(asteroids.length).toBeGreaterThanOrEqual(5);

  const target = asteroids[0];

  // Wait out spawn protection so the collision actually deals damage.
  await game.waitForCombatReady();

  // Collide with one specific asteroid.
  await game.collideShipWithAsteroid(target);

  // Collision detection registered: the ship took damage...
  await expect
    .poll(() => game.getShipHealth(), { timeout: 8000, message: 'collision should damage the ship' })
    .toBeLessThan(100);

  // ...and the targeted asteroid was destroyed (its id is gone from the belt).
  await expect
    .poll(async () => (await game.getAsteroidPositions()).some((a) => a.id === target.id), {
      timeout: 8000,
      message: 'the collided asteroid should be destroyed',
    })
    .toBe(false);
}, TestConfig.DEFAULT_TIMEOUT);
