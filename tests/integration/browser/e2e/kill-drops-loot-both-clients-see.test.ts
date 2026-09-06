import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { bootTwoClientGames } from '../../utils/multi-client-setup';
import { TestConfig } from '../../utils/test-config';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

test('two clients see the same kill-loot drops', async () => {
  const { page1, page2, game1, game2 } = await bootTwoClientGames(browserManager);
  const startMass = await game1.getShipMass();
  const startRadius = await game1.getShipRadius();
  const startMaxHealth = await game1.getShipMaxHealth();

  await game2.waitForCombatReady();
  await game2.placeShipAt(80, 0);
  await game2.syncShipPositionToServer();
  await game2.killLocalPlayerUntilLifeLost();

  await expect
    .poll(
      async () => {
        const loot1 = await game1.getLoot();
        const loot2 = await game2.getLoot();
        if (loot1.length === 0 || loot2.length === 0) {
          return false;
        }
        const ids1 = [...loot1.map((drop) => drop.id)].sort();
        const ids2 = [...loot2.map((drop) => drop.id)].sort();
        return ids1.join(',') === ids2.join(',');
      },
      { timeout: 12000, message: 'both clients should share the same kill-loot ids' }
    )
    .toBe(true);

  const loot1 = await game1.getLoot();
  const loot2 = await game2.getLoot();
  for (const drop of loot1) {
    const peer = loot2.find((other) => other.id === drop.id);
    expect(peer).toBeDefined();
    expect(Math.abs(peer!.x - drop.x)).toBeLessThan(8);
    expect(Math.abs(peer!.y - drop.y)).toBeLessThan(8);
  }

  await page1.screenshot({
    path: screenshotManager.getScreenshotPath('kill-loot-client1-shared-drops.png'),
  });
  await page2.screenshot({
    path: screenshotManager.getScreenshotPath('kill-loot-client2-shared-drops.png'),
  });

  const pellet = loot1[0];
  expect(pellet).toBeDefined();
  await game1.placeShipAt(pellet!.x, pellet!.y);
  await game1.syncShipPositionToServer();

  await expect
    .poll(async () => game1.getShipMass(), {
      timeout: 8000,
      message: 'collector should grow after picking up kill loot',
    })
    .toBeGreaterThan(startMass);

  expect(await game1.getShipRadius()).toBeGreaterThan(startRadius);
  expect(await game1.getShipMaxHealth()).toBeGreaterThan(startMaxHealth);

  await page1.screenshot({
    path: screenshotManager.getScreenshotPath('kill-loot-client1-after-collect.png'),
  });
}, TestConfig.DEFAULT_TIMEOUT * 2);
