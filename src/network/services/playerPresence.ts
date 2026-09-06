/**
 * Remote-player presence helpers.
 *
 * The server removes a human on socket close but never broadcasts `playerLeft`.
 * `handleGameState` also updates entities in place and never prunes the map
 * (clearing it used to make bots flicker). Together that leaves a closed tab
 * on everyone else's leaderboard until a refresh.
 *
 * These helpers drop only `type === 'remote'` humans missing from the latest
 * authoritative snapshot. Local and bot entries stay — bots can be omitted
 * from a snapshot without having left the world.
 */

export function staleRemotePlayerIds(
  players: Iterable<{ id: string; type: string }>,
  snapshotEntityIds: ReadonlySet<string>
): string[] {
  const stale: string[] = [];
  for (const player of players) {
    if (player.type === 'remote' && !snapshotEntityIds.has(player.id)) {
      stale.push(player.id);
    }
  }
  return stale;
}

/** Close the gameplay socket when the tab is hidden/unloaded (including bfcache). */
export function bindPageHideDisconnect(disconnect: () => void): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('pagehide', disconnect);
}
