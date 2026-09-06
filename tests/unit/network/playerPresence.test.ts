import { expect, test } from 'vitest';
import { bindPageHideDisconnect, staleRemotePlayerIds } from '../../../src/network/services/playerPresence';

test('a remote missing from the snapshot is stale', () => {
  const players = [
    { id: 'local-1', type: 'local' },
    { id: 'remote-gone', type: 'remote' },
    { id: 'remote-still', type: 'remote' },
    { id: 'bot-1', type: 'bot' },
  ];
  const snapshot = new Set(['local-1', 'remote-still', 'bot-1']);

  expect(staleRemotePlayerIds(players, snapshot)).toEqual(['remote-gone']);
});

test('bots and the local player are never treated as stale', () => {
  const players = [
    { id: 'local-1', type: 'local' },
    { id: 'bot-1', type: 'bot' },
  ];

  expect(staleRemotePlayerIds(players, new Set())).toEqual([]);
});

test('an empty remote list against a populated snapshot is a no-op', () => {
  expect(staleRemotePlayerIds([], new Set(['anyone']))).toEqual([]);
});

test('pagehide runs the disconnect callback', () => {
  let called = 0;
  bindPageHideDisconnect(() => {
    called += 1;
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(called).toBe(1);
});
