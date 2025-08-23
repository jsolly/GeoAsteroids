// Debug configuration module that reads from environment variables
export interface DebugConfig {
  botCount: number;
  disableMovement: boolean;
  disableBotMovement: boolean;
  disableBotGuns: boolean;
  placeAsteroidOnBot: boolean;
  debugAsteroidCount: number;
  localPlayerInvincible: boolean;
  drawAsteroids: boolean;
  disableAsteroidMultiplication: boolean;
  disableAsteroidMovement: boolean;
  disableBotSpawnProtection: boolean;
}

// Default configuration that doesn't interfere with normal gameplay
const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  botCount: 1,
  disableMovement: false,
  disableBotMovement: false, // Changed from true to false - bots move normally by default
  disableBotGuns: false,
  placeAsteroidOnBot: false,
  debugAsteroidCount: 100,
  localPlayerInvincible: false,
  drawAsteroids: true,
  disableAsteroidMultiplication: false,
  disableAsteroidMovement: false,
  disableBotSpawnProtection: false,
};

// Environment variable configuration that overrides defaults when debug mode is enabled
const ENV_DEBUG_CONFIG: DebugConfig = {
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

export function getDebugConfig(): DebugConfig {
  // Return default config - environment variables only apply when debug mode is explicitly enabled
  return { ...DEFAULT_DEBUG_CONFIG };
}

// Function to get debug config with environment variable overrides (only called when debug mode is enabled)
export function getDebugConfigWithEnvOverrides(): DebugConfig {
  return { ...DEFAULT_DEBUG_CONFIG, ...ENV_DEBUG_CONFIG };
}

// Helper function to check if debug mode is enabled
export function isDebugModeEnabled(): boolean {
  return import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'development';
}

// Helper function to get a specific debug config value
export function getDebugConfigValue<K extends keyof DebugConfig>(key: K): DebugConfig[K] {
  return getDebugConfig()[key];
}
