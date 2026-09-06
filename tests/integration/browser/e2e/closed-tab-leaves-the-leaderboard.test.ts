import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { bootTwoClientGames } from '../../utils/multi-client-setup';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('closed tab leaves the other player leaderboard', async () => {
  const { page2, game1 } = await bootTwoClientGames(browserManager);

  const departingId = (await game1.getRemoteHumanPlayerIds())[0];
  expect(departingId, 'client 1 should see client 2 on the board before close').toBeTruthy();

  const boardBefore = await game1.getLeaderboardEntries();
  expect(boardBefore.some((entry) => entry.id === departingId)).toBe(true);

  await page2.close();

  await expect
    .poll(
      async () => {
        const remotes = await game1.getRemoteHumanPlayerIds();
        const board = await game1.getLeaderboardEntries();
        return remotes.length === 0 && !board.some((entry) => entry.id === departingId);
      },
      { timeout: 10000, message: 'closed tab should leave client 1 leaderboard' }
    )
    .toBe(true);
}, TestConfig.DEFAULT_TIMEOUT * 2);
