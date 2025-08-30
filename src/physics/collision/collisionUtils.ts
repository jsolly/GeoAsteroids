import { DEBUG } from '../../constants';
import type { Player } from '../../entities/player/Player';
import { isBot } from '../../entities/player/playerKinds';
import type { Ship } from '../../entities/ship/Ship';
import { isDebugMode } from '../../utils/debugUtils';

// Helper function to check if a player should skip collision detection
export function shouldSkipPlayerCollision(player: Player): boolean {
  // Only apply debug rules if debug mode is actually enabled via environment
  if (isDebugMode() && DEBUG.DISABLE_BOT_SPAWN_PROTECTION && isBot(player)) {
    // Only skip if bot is blinking, not if it has spawn protection
    return player.ship.blinkCount > 0;
  }

  // Use standard invincibility rules
  return player.ship.blinkCount > 0 || player.spawnProtectedUntil > Date.now();
}

// Helper function to check if damage should be applied to local player
export function shouldApplyDamageToLocalPlayer(_ship: Ship): boolean {
  // Only apply debug rules if debug mode is actually enabled via environment
  if (isDebugMode() && DEBUG.LOCAL_PLAYER_INVINCIBLE) {
    return false; // No damage in debug invincibility mode
  }

  return true; // Always apply damage in normal mode
}

// Helper function to check if a player is invincible
export function isPlayerInvincible(player: Player): boolean {
  // Only apply debug rules if debug mode is actually enabled via environment
  if (isDebugMode() && DEBUG.DISABLE_BOT_SPAWN_PROTECTION && isBot(player)) {
    // Only consider blinking invincibility, ignore spawn protection
    return player.ship.blinkCount > 0;
  }

  // Use standard invincibility rules
  return player.ship.blinkCount > 0 || player.spawnProtectedUntil > Date.now();
}

// Helper function to check if a ship is invincible
export function isShipInvincible(ship: Ship): boolean {
  return ship.blinkCount > 0;
}
