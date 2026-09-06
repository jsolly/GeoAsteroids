import type { Player } from './Player';

/**
 * Advance remote human ships on the shared 60 Hz lifecycle clock.
 *
 * Pose stays server-driven (`updateLifecycle` does not predict movement).
 * Explode / blink must still tick or remotes freeze at the first death frame
 * and stay laser-immune after respawn. Lasers still move once per display
 * frame so shots travel instead of sitting on the muzzle (#418).
 */
export function advanceRemotePlayerShips(players: Player[], lifecycleFrames = 1): void {
  for (const player of players) {
    if (player.type === 'remote') {
      player.ship.updateLifecycle(lifecycleFrames);
      if (!player.ship.exploding && player.ship.health > 0) {
        player.ship.moveLasers();
      }
    }
  }
}
