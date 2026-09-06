import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { bootTwoClientGames } from '../../utils/multi-client-setup';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('two clients see the same kill-loot drops', async () => {
  const { game1, game2 } = await bootTwoClientGames(browserManager);

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
}, TestConfig.DEFAULT_TIMEOUT * 2);
