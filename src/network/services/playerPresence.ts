/**
 * Remote-player presence helpers.
 *
 * The server removes a human on socket close and now also broadcasts
 * `playerLeft`. `handleGameState` still updates entities in place (clearing
 * the map used to make bots flicker), so snapshot pruning remains the
 * fallback if a `playerLeft` is dropped.
 *
 * These helpers drop only `type === 'remote'` humans missing from the latest
 * authoritative snapshot. Local and bot entries stay — bots can be omitted
 * from a snapshot without having left the world.
 */

/** True when this snapshot row is the local pilot, including a new-id clone. */
export function isLocalGameEntity(
  entity: { id: string; name?: string; type?: string },
  local: { clientId: string; localPlayerId: string; localPlayerName: string }
): boolean {
  if (entity.id === local.clientId || entity.id === local.localPlayerId) {
    return true;
  }
  return Boolean(
    local.localPlayerName && entity.type === 'human' && entity.name === local.localPlayerName
  );
}

/** Drop remotes that are just another copy of our display name. */
export function duplicateOwnRemoteIds(
  players: Iterable<{ id: string; name: string; type: string }>,
  localPlayerName: string
): string[] {
  if (!localPlayerName) {
    return [];
  }
  const stale: string[] = [];
  for (const player of players) {
    if (player.type === 'remote' && player.name === localPlayerName) {
      stale.push(player.id);
    }
  }
  return stale;
}

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
