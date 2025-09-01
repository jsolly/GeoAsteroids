/**
 * Unified Constants - Consolidated from all constant files
 * Organized by domain for better maintainability
 */

// ============================================================================
// GAME CONFIGURATION
// ============================================================================
export const GAME = {
  // Lives and scoring
  START_LIVES: 3,
  STARTING_SCORE: 0,

  // Multiplayer (can be overridden by DEBUG.BOT_COUNT when in debug mode)
  BOT_COUNT: 9,

  // Physics
  FPS: 60,
  FRICTION: 0.6,
} as const;

// ============================================================================
// CANVAS CONFIGURATION
// ============================================================================
export const CANVAS = {
  INTERNAL_WIDTH: 800,
  INTERNAL_HEIGHT: 600,
  DEFAULT_CENTER_X: 400,
  DEFAULT_CENTER_Y: 300,

  // Text rendering
  TEXT_SIZE: 40,
  TEXT_FADE_TIME: 2.5,
} as const;

// ============================================================================
// SHIP CONFIGURATION
// ============================================================================
export const SHIP = {
  // Movement
  TURN_SPEED: 450, // degrees per second
  THRUST: 5, // pixels per second² (acceleration)
  MAX_VELOCITY: 8, // pixels per second
  BOT_FRICTION: 2.0, // higher = more friction for bots
  SIZE: 30, // height in pixels

  // Combat
  MAX_LASERS: 5, // maximum lasers a ship can have at once

  // Health
  MAX_HEALTH: 100,
  COLLISION_DAMAGE: 20,
  HEALTH_REGEN_RATE: 1, // per second
  HEALTH_REGEN_DELAY: 5, // seconds

  // Timing (in frames at 60 FPS)
  EXPLODE_DURATION_FRAMES: 18, // 0.3 seconds
  INVINCIBILITY_DURATION_FRAMES: 180, // 3 seconds
  INVINCIBILITY_BLINK_DURATION_FRAMES: 6, // 0.1 seconds
} as const;

// ============================================================================
// LASER CONFIGURATION
// ============================================================================
export const LASER = {
  SPEED: 300, // pixels per second
  MAX_COUNT: 200, // limit of lasers that can exist
  TRAVEL_DISTANCE_RATIO: 0.6, // fraction of screen width
  EXPLODE_DURATION: 0.1, // seconds
} as const;

// ============================================================================
// ASTEROID (ROID) CONFIGURATION
// ============================================================================
export const ROID = {
  // Movement and size
  SPEED: 50, // starting speed in pixels per second
  SIZE: 50, // starting size in pixels
  VERTICES: 10, // average number of vertices
  JAGGEDNESS: 0.5, // 0 = smooth, 1 = jagged

  // Scoring
  POINTS_LARGE: 20,
  POINTS_MEDIUM: 50,
  POINTS_SMALL: 100,

  // Spawning (can be overridden by DEBUG.INITIAL_ROID_COUNT when in debug mode)
  INITIAL_ROID_COUNT: 10,
  MIN_COUNT: 5,
  MAX_COUNT: 20,
  SPAWN_TIME_FRAMES: 180, // 3 seconds at 60 FPS
} as const;

// ============================================================================
// EMP PULSE CONFIGURATION
// ============================================================================
export const EMP = {
  RADIUS: 250, // pixels
  DURATION: 0.5, // seconds
} as const;

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================
export const DEBUG = {
  // Master switch for debug features
  ENABLED: true,

  // Player settings
  LOCAL_PLAYER_INVINCIBLE: false,

  // Bot settings (overrides GAME.BOT_COUNT when in debug mode)
  BOT_COUNT: 5,
  DISABLE_BOT_MOVEMENT: true,
  DISABLE_BOT_LASERS: true,
  DISABLE_BOT_SPAWN_PROTECTION: false,

  // Roid settings (overrides ROID.INITIAL_ROID_COUNT when in debug mode)
  INITIAL_ROID_COUNT: 50,
  DISABLE_ROID_MOVEMENT: true,
  PLACE_ROID_ON_BOT: false,

  // Roid splitting settings (overrides server-side defaults when in debug mode)
  MIN_ROID_SIZE: 10,
  SPLIT_SIZE_RATIO: 0.6,
  MAX_ROID_COUNT: 200,

  // Player positioning settings (Affects local, remote, and bot players)
  PLACE_PLAYERS_NEAR_CENTER: true,
} as const;

// ============================================================================
// USER PREFERENCES
// ============================================================================
export const PREFERENCES = {
  LOCAL_STORAGE_KEYS: {
    SOUND_ON: 'soundOn',
  } as const,
} as const;

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================
export const LOGGING = {
  // Global log level that affects both client and server logging
  // This controls what gets written to both server.log and client.log
  GLOBAL_LOG_LEVEL: 'debug' as 'error' | 'warn' | 'info' | 'debug',

  // Whether to forward client logs to the server
  FORWARD_TO_SERVER: true,

  // Whether to write logs to browser console
  WRITE_TO_CONSOLE: false,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }

  try {
    const soundPref = localStorage.getItem(PREFERENCES.LOCAL_STORAGE_KEYS.SOUND_ON);
    return soundPref === 'true';
  } catch (error) {
    // Use console.warn instead of logger to avoid circular dependency
    console.warn('UTILS', `Failed to access localStorage for sound preference: ${String(error)}`);
    return false;
  }
};

// Initialize sound preference checkbox after DOM is ready
function initializeSoundPreference() {
  const soundCheckbox = document.getElementById('soundPref') as HTMLInputElement;
  if (soundCheckbox) {
    soundCheckbox.checked = isSoundEnabled();
  }
}

// Run initialization when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    // DOM not yet ready, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initializeSoundPreference);
  } else {
    // DOM already ready, initialize immediately
    initializeSoundPreference();
  }
}
