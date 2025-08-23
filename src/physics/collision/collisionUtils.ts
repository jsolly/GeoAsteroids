import type { Player } from '../../entities/player/types';
import type { Ship } from '../../entities/ship/Ship';

// Global debug state that can be set by the game controller
let DEBUG_MODE_ENABLED = false;

// Debug configuration that reads from environment variables
const DEBUG_CONFIG = {
  localPlayerInvincible: import.meta.env.VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE === 'true',
  disableBotSpawnProtection: import.meta.env.VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION === 'true',
};

// Function to enable debug mode (called by game controller)
export function enableDebugMode(): void {
  DEBUG_MODE_ENABLED = true;
}

// Function to check if debug mode is enabled
export function isDebugModeEnabled(): boolean {
  return DEBUG_MODE_ENABLED;
}

// Helper function to check if a player should skip collision detection
export function shouldSkipPlayerCollision(player: Player): boolean {
  // In debug mode, check if spawn protection should be disabled
  if (isDebugModeEnabled() && DEBUG_CONFIG.disableBotSpawnProtection) {
    // Only skip if bot is blinking, not if it has spawn protection
    return player.ship.blinkCount > 0;
  }

  // Use standard invincibility rules
  return player.ship.blinkCount > 0 || player.spawnProtectedUntil > Date.now();
}

// Helper function to check if damage should be applied to local player
export function shouldApplyDamageToLocalPlayer(_ship: Ship): boolean {
  // In debug mode, check if invincibility is enabled
  if (isDebugModeEnabled() && DEBUG_CONFIG.localPlayerInvincible) {
    return false; // No damage in debug invincibility mode
  }

  return true; // Always apply damage in normal mode
}

// Helper function to check if a player is invincible
export function isPlayerInvincible(player: Player): boolean {
  // In debug mode, check if spawn protection should be disabled
  if (isDebugModeEnabled() && DEBUG_CONFIG.disableBotSpawnProtection) {
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

// Helper function to dispatch bot destroyed events
export function dispatchBotDestroyedEvent(
  botId: string,
  killedBy: string,
  botType: string = 'unknown'
) {
  window.dispatchEvent(
    new CustomEvent('botDestroyed', {
      detail: { botId, botType, killedBy },
    })
  );
}

// Debug logging functions
export function logCollisionDetection(
  collisionType: string,
  source: string,
  target: string,
  damageApplied: boolean
): void {
  if (isDebugModeEnabled()) {
    console.info(
      'DEBUG_COLLISIONS',
      `${collisionType}: ${source} vs ${target}, damage: ${damageApplied ? 'YES' : 'NO'}`
    );
  }
}

export function logBotHealthChange(
  bot: Player,
  oldHealth: number,
  newHealth: number,
  damageAmount: number
): void {
  if (isDebugModeEnabled()) {
    console.info(
      'DEBUG_COLLISIONS',
      `Bot ${bot.name} health: ${oldHealth} -> ${newHealth} (damage: ${damageAmount})`
    );
  }
}

// Export debug config for other modules to use
export function getDebugConfig() {
  return {
    botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),
    disableMovement: import.meta.env.VITE_DEBUG_DISABLE_MOVEMENT === 'true',
    disableBotMovement: import.meta.env.VITE_DEBUG_DISABLE_BOT_MOVEMENT === 'true',
    disableBotGuns: import.meta.env.VITE_DEBUG_DISABLE_BOT_GUNS === 'true',
    placeAsteroidOnBot: import.meta.env.VITE_DEBUG_PLACE_ASTEROID_ON_BOT === 'true',
    debugAsteroidCount: parseInt(import.meta.env.VITE_DEBUG_ASTEROID_COUNT || '100', 10),
    localPlayerInvincible: import.meta.env.VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE === 'true',
    drawAsteroids: import.meta.env.VITE_DEBUG_DRAW_ASTEROIDS !== 'false',
    disableAsteroidMultiplication:
      import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MULTIPLICATION === 'true',
    disableAsteroidMovement: import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MOVEMENT === 'true',
    disableBotSpawnProtection: import.meta.env.VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION === 'true',
  };
}
