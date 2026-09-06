import { expect, test } from 'vitest';
import {
  bindPageHideDisconnect,
  duplicateOwnRemoteIds,
  fillSnapshotEntityIds,
  isLocalGameEntity,
  pruneDuplicateOwnRemotes,
  pruneStaleRemotePlayers,
  staleRemotePlayerIds,
} from '../../../src/network/services/playerPresence';

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

test('a same-name human snapshot is treated as the local pilot', () => {
  const local = { clientId: 'client-a', localPlayerId: 'client-a', localPlayerName: 'PilotB' };
  expect(isLocalGameEntity({ id: 'client-a', type: 'human', name: 'PilotB' }, local)).toBe(true);
  expect(isLocalGameEntity({ id: 'client-z', type: 'human', name: 'PilotB' }, local)).toBe(true);
  expect(isLocalGameEntity({ id: 'client-z', type: 'human', name: 'NeonLightning' }, local)).toBe(
    false
  );
  expect(isLocalGameEntity({ id: 'server-bot-0', type: 'bot', name: 'PilotB' }, local)).toBe(false);
});

test('remote copies of the local name are duplicates', () => {
  const players = [
    { id: 'me', name: 'PilotB', type: 'local' },
    { id: 'ghost-1', name: 'PilotB', type: 'remote' },
    { id: 'ghost-2', name: 'PilotB', type: 'remote' },
    { id: 'friend', name: 'NeonLightning', type: 'remote' },
  ];
  expect(duplicateOwnRemoteIds(players, 'PilotB')).toEqual(['ghost-1', 'ghost-2']);
});

test('fillSnapshotEntityIds clears and reuses the same Set', () => {
  const into = new Set(['stale-id']);
  const same = fillSnapshotEntityIds([{ id: 'a' }, { id: 'b' }], into);
  expect(same).toBe(into);
  expect([...into].sort()).toEqual(['a', 'b']);
});

test('pruneStaleRemotePlayers deletes only remotes missing from the snapshot', () => {
  const players = new Map<string, { type: string }>([
    ['local-1', { type: 'local' }],
    ['remote-gone', { type: 'remote' }],
    ['remote-still', { type: 'remote' }],
    ['bot-1', { type: 'bot' }],
  ]);
  const snapshot = new Set(['local-1', 'remote-still', 'bot-1']);

  expect(pruneStaleRemotePlayers(players, snapshot)).toBe(1);
  expect([...players.keys()].sort()).toEqual(['bot-1', 'local-1', 'remote-still']);
});

test('pruneDuplicateOwnRemotes deletes same-name remotes in place', () => {
  const players = new Map<string, { name: string; type: string }>([
    ['me', { name: 'PilotB', type: 'local' }],
    ['ghost', { name: 'PilotB', type: 'remote' }],
    ['friend', { name: 'Castle', type: 'remote' }],
  ]);
  expect(pruneDuplicateOwnRemotes(players, 'PilotB')).toBe(1);
  expect([...players.keys()].sort()).toEqual(['friend', 'me']);
});

test('pagehide runs the disconnect callback', () => {
  let called = 0;
  bindPageHideDisconnect(() => {
    called += 1;
  });
  window.dispatchEvent(new Event('pagehide'));
  expect(called).toBe(1);
});
