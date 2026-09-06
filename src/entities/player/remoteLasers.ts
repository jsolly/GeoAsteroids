import type { Player } from './Player';

/**
 * Advance client-side lasers for remote human players.
 *
 * Remote ships are server-driven: the game loop calls `Ship.update()` only for
 * the local player and bots, never for `type === 'remote'`. Remote lasers are
 * created locally from the server's `playerShoot` broadcast (see
 * `ConnectionManager.handlePlayerShoot`) but, without an update tick, they would
 * freeze at the muzzle forever — you'd see another player's shot appear as a
 * stationary dot and never travel, and the lasers would accumulate unbounded.
 *
 * Calling `moveLasers()` each frame makes other players' shots travel and
 * expire exactly like local/bot lasers, so firing is visible across tabs.
 */
export function advanceRemotePlayerLasers(players: Player[]): void {
  for (const player of players) {
    if (player.type === 'remote') {
      player.ship.moveLasers();
    }
  }
}
