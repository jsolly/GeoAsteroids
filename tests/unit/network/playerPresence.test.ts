import { expect, test } from 'vitest';
import {
  bindPageHideDisconnect,
  fillSnapshotEntityIds,
  isLocalGameEntity,
  pruneStaleRemotePlayers,
} from '../../../src/network/services/playerPresence';

test('only matching ids identify the local pilot', () => {
  const local = { clientId: 'client-a', localPlayerId: 'server-a' };
  expect(isLocalGameEntity({ id: 'client-a', type: 'player', name: 'PilotB' }, local)).toBe(true);
  expect(isLocalGameEntity({ id: 'client-z', type: 'player', name: 'PilotB' }, local)).toBe(false);
  expect(isLocalGameEntity({ id: 'client-z', type: 'player', name: 'NeonLightning' }, local)).toBe(
    false
  );
  expect(isLocalGameEntity({ id: 'other-player', type: 'player', name: 'Other' }, local)).toBe(
    false
  );
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
  ]);
  const snapshot = new Set(['remote-still']);

  expect(pruneStaleRemotePlayers(players, snapshot)).toBe(1);
  expect([...players.keys()].sort()).toEqual(['local-1', 'remote-still']);
});

test('pagehide disconnects only while the browser runtime is mounted', () => {
  const scope = new AbortController();
  let called = 0;
  bindPageHideDisconnect(() => {
    called += 1;
  }, scope.signal);
  window.dispatchEvent(new Event('pagehide'));
  expect(called).toBe(1);
  scope.abort();
  window.dispatchEvent(new Event('pagehide'));
  expect(called).toBe(1);
});
