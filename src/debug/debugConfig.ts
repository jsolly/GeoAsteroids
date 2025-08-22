// Debug configuration module that reads from environment variables
export interface DebugConfig {
  botCount: number;
  disableMovement: boolean;
  disableBotMovement: boolean;
  disableBotGuns: boolean;
  placeAsteroidOnBot: boolean;
  debugAsteroidCount: number;
  invincible: boolean;
  drawAsteroids: boolean;
  disableAsteroidMultiplication: boolean;
  disableAsteroidMovement: boolean;
  disableBotSpawnProtection: boolean;
}

export function getDebugConfig(): DebugConfig {
  return {
    // Number of bots to create in debug mode (default: 1)
    botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),

    // Disable all movement in debug mode (default: false)
    disableMovement: import.meta.env.VITE_DEBUG_DISABLE_MOVEMENT === 'true',

    // Disable bot movement in debug mode (default: true)
    disableBotMovement: import.meta.env.VITE_DEBUG_DISABLE_BOT_MOVEMENT !== 'false',

    // Disable bot guns in debug mode (default: false)
    disableBotGuns: import.meta.env.VITE_DEBUG_DISABLE_BOT_GUNS === 'true',

    // Place asteroid on top of each bot when debug mode loads (default: false)
    placeAsteroidOnBot: import.meta.env.VITE_DEBUG_PLACE_ASTEROID_ON_BOT === 'true',

    // Number of extra asteroids to spawn in debug mode (default: 100)
    debugAsteroidCount: parseInt(import.meta.env.VITE_DEBUG_ASTEROID_COUNT || '100', 10),

    // Player invincibility in debug mode (default: false)
    invincible: import.meta.env.VITE_DEBUG_INVINCIBLE === 'true',

    // Draw asteroids in debug mode (default: true)
    drawAsteroids: import.meta.env.VITE_DEBUG_DRAW_ASTEROIDS !== 'false',

    // Disable asteroid multiplication over time (default: false)
    disableAsteroidMultiplication:
      import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MULTIPLICATION === 'true',

    // Disable asteroid movement (default: false)
    disableAsteroidMovement: import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MOVEMENT === 'true',

    // Disable bot spawn protection for testing collision systems (default: false)
    // When enabled, bots will take damage from collisions even during spawn protection period
    // This is useful for testing collision detection without waiting for spawn protection to expire
    disableBotSpawnProtection: import.meta.env.VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION === 'true',
  };
}

// Helper function to check if debug mode is enabled
export function isDebugModeEnabled(): boolean {
  return import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'development';
}

// Helper function to get a specific debug config value
export function getDebugConfigValue<K extends keyof DebugConfig>(key: K): DebugConfig[K] {
  return getDebugConfig()[key];
}
