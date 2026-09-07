import { expect, test } from 'vitest';
import { uniquePlayersForLeaderboard } from '../../../src/rendering/hud/leaderboard';

test('three PilotB rows collapse to the local ship', () => {
  const rows = uniquePlayersForLeaderboard(
    [
      { id: 'old-1', name: 'PilotB', type: 'remote', score: 0 },
      { id: 'old-2', name: 'PilotB', type: 'remote', score: 0 },
      { id: 'me', name: 'PilotB', type: 'local', score: 450 },
      { id: 'friend', name: 'NeonLightning', type: 'remote', score: 210 },
    ],
    'me'
  );

  expect(rows.map((row) => `${row.name}:${row.score}`)).toEqual([
    'PilotB:450',
    'NeonLightning:210',
  ]);
});
