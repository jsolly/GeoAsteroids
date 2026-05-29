import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { BrowserManager } from './browser-manager';
import { HealthChecker } from './health-checker';
import { ScreenshotManager } from './screenshot-manager';

/** Shared browser lifecycle hooks for scenario integration tests. */
export function createBrowserScenarioHooks(testDir: string): {
  browserManager: BrowserManager;
  screenshotManager: ScreenshotManager;
} {
  const browserManager = new BrowserManager();
  const screenshotManager = new ScreenshotManager(testDir);

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

  return { browserManager, screenshotManager };
}
