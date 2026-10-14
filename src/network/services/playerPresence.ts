/** Match private local identity by id; display names do not identify pilots. */
export function isLocalGameEntity(
  entity: { id: string; name?: string; type?: string },
  local: { clientId: string; localPlayerId: string }
): boolean {
  return entity.id === local.clientId || entity.id === local.localPlayerId;
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
 * `handleSnapshotState` does not allocate an id array every broadcast.
 * Returns how many remotes were removed.
 */
export function pruneStaleRemotePlayers<T extends { type: string }>(
  players: Map<string, T>,
  snapshotEntityIds: ReadonlySet<string>
) {
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
export function bindPageHideDisconnect(disconnect: () => void, signal: AbortSignal): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('pagehide', disconnect, { signal });
}
