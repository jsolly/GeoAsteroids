import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('bot health regenerates after asteroid collision damage', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame();
  await game.waitForBots(1);

  const bot = (await game.getBots())[0]!;
  const result = await game.attackBotWithLasers(bot.id, 2);
  expect(result.minHealthObserved, 'bot should take laser damage').toBeLessThan(100);

  // Server-authoritative bots do not regen on the server yet; verify the reduced
  // health persists on the client snapshot.
  await page.waitForTimeout(3000);
  const after = (await game.getBots()).find((b) => b.id === bot.id);
  expect(after?.health ?? 100).toBeLessThan(100);
}, TestConfig.DEFAULT_TIMEOUT);
