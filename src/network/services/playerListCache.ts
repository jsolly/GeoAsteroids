/** Rebuild cached arrays only when map membership changes; in-place updates share Player references. */

export class PlayerListCache<T extends { type: string }> {
  private all: T[] | null = null;
  private remotes: T[] | null = null;

  invalidate(): void {
    this.all = null;
    this.remotes = null;
  }

  allPlayers(players: Map<string, T>): T[] {
    this.all ??= Array.from(players.values());
    return this.all;
  }

  remotePlayers(players: Map<string, T>): T[] {
    if (this.remotes === null) {
      const remotes: T[] = [];
      for (const player of players.values()) {
        if (player.type === 'remote') {
          remotes.push(player);
        }
      }
      this.remotes = remotes;
    }
    return this.remotes;
  }
}
