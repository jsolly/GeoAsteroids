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

/** Clear and refill `into` with this snapshot's entity ids — no new Set per tick. */
export function fillSnapshotEntityIds(
  entities: ReadonlyArray<{ id: string }>,
  into: Set<string>
): Set<string> {
  into.clear();
  for (const entity of entities) {
    into.add(entity.id);
  }
  return into;
}

/**
 * Drop remotes missing from the snapshot. Mutates `players` in place so
 * `handleGameState` does not allocate an id array every broadcast.
 * Returns how many remotes were removed.
 */
export function pruneStaleRemotePlayers<T extends { type: string }>(
  players: Map<string, T>,
  snapshotEntityIds: ReadonlySet<string>
): number {
  let removed = 0;
  for (const [id, player] of players) {
    if (player.type === 'remote' && !snapshotEntityIds.has(id)) {
      players.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/** Close the gameplay socket when the tab is hidden/unloaded (including bfcache). */
export function bindPageHideDisconnect(disconnect: () => void): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('pagehide', disconnect);
}
