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

  // Multiplayer
  MULTIPLAYER_ENABLED: true,
  DEFAULT_BOT_COUNT: 9,

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

  // Spawning
  INITIAL_COUNT: 10,
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
  // Player settings
  LOCAL_PLAYER_INVINCIBLE: false,

  // Bot settings
  BOT_COUNT: 1,
  DISABLE_BOT_MOVEMENT: false,
  DISABLE_BOT_LASERS: false,
  DISABLE_BOT_SPAWN_PROTECTION: false,
  PLACE_BOTS_NEAR_LOCAL_PLAYER: false,

  // Roid settings
  ROID_COUNT: 100,
  DISABLE_ROID_MOVEMENT: false,
  PLACE_ROID_ON_BOT: false,

  // Multiplayer settings
  PLACE_REMOTE_PLAYERS_NEAR_EACH_OTHER: false,
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
    console.warn('Failed to access localStorage for sound preference:', error);
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

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================
// These can be gradually removed as code is updated to use the new structure
export const START_LIVES = GAME.START_LIVES;
export const STARTING_SCORE = GAME.STARTING_SCORE;
export const MULTIPLAYER_ENABLED = GAME.MULTIPLAYER_ENABLED;
export const DEFAULT_BOT_COUNT = GAME.DEFAULT_BOT_COUNT;
export const FPS = GAME.FPS;
export const FRICTION = GAME.FRICTION;

export const CANVAS_INTERNAL_WIDTH = CANVAS.INTERNAL_WIDTH;
export const CANVAS_INTERNAL_HEIGHT = CANVAS.INTERNAL_HEIGHT;
export const CANVAS_DEFAULT_CENTER_X = CANVAS.DEFAULT_CENTER_X;
export const CANVAS_DEFAULT_CENTER_Y = CANVAS.DEFAULT_CENTER_Y;
export const TEXT_SIZE = CANVAS.TEXT_SIZE;
export const TEXT_FADE_TIME = CANVAS.TEXT_FADE_TIME;

export const TURN_SPEED = SHIP.TURN_SPEED;
export const SHIP_MAX_LASERS = SHIP.MAX_LASERS;
export const SHIP_MAX_HEALTH = SHIP.MAX_HEALTH;
export const SHIP_COLLISION_DAMAGE = SHIP.COLLISION_DAMAGE;
export const SHIP_HEALTH_REGEN_RATE = SHIP.HEALTH_REGEN_RATE;
export const SHIP_HEALTH_REGEN_DELAY = SHIP.HEALTH_REGEN_DELAY;
export const SHIP_THRUST = SHIP.THRUST;
export const SHIP_MAX_VELOCITY = SHIP.MAX_VELOCITY;
export const SHIP_BOT_FRICTION = SHIP.BOT_FRICTION;
export const SHIP_SIZE = SHIP.SIZE;
export const SHIP_EXPLODE_DUR_FRAMES = SHIP.EXPLODE_DURATION_FRAMES;
export const SHIP_INV_DUR_FRAMES = SHIP.INVINCIBILITY_DURATION_FRAMES;
export const SHIP_INV_BLINK_DUR_FRAMES = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;

export const LASER_SPEED = LASER.SPEED;
export const LASER_MAX = LASER.MAX_COUNT;
export const LASER_DIST = LASER.TRAVEL_DISTANCE_RATIO;
export const LASER_EXPLODE_DUR = LASER.EXPLODE_DURATION;

export const ROID_SPEED = ROID.SPEED;
export const ROID_SIZE = ROID.SIZE;
export const ROID_VERTICES = ROID.VERTICES;
export const ROID_JAGG = ROID.JAGGEDNESS;
export const ROID_POINTS_LRG = ROID.POINTS_LARGE;
export const ROID_POINTS_MED = ROID.POINTS_MEDIUM;
export const ROID_POINTS_SML = ROID.POINTS_SMALL;
export const ROID_SPAWN_TIME = ROID.SPAWN_TIME_FRAMES;
export const ROID_NUM = ROID.INITIAL_COUNT;
export const ROID_MIN_COUNT = ROID.MIN_COUNT;
export const ROID_MAX_COUNT = ROID.MAX_COUNT;

export const EMP_PULSE_RADIUS = EMP.RADIUS;
export const EMP_PULSE_DURATION = EMP.DURATION;

export const LOCAL_STORAGE_KEYS = PREFERENCES.LOCAL_STORAGE_KEYS;
export const soundIsOn = isSoundEnabled;

// Debug constants (for backward compatibility)
export const DEBUG_LOCAL_PLAYER_INVINCIBLE = DEBUG.LOCAL_PLAYER_INVINCIBLE;
export const DEBUG_BOT_COUNT = DEBUG.BOT_COUNT;
export const DEBUG_ROID_COUNT = DEBUG.ROID_COUNT;
export const DEBUG_DISABLE_BOT_MOVEMENT = DEBUG.DISABLE_BOT_MOVEMENT;
export const DEBUG_DISABLE_BOT_LASERS = DEBUG.DISABLE_BOT_LASERS;
export const DEBUG_DISABLE_BOT_SPAWN_PROTECTION = DEBUG.DISABLE_BOT_SPAWN_PROTECTION;
export const DEBUG_PLACE_BOTS_NEAR_LOCAL_PLAYER = DEBUG.PLACE_BOTS_NEAR_LOCAL_PLAYER;
export const DEBUG_DISABLE_ROID_MOVEMENT = DEBUG.DISABLE_ROID_MOVEMENT;
export const DEBUG_PLACE_ROID_ON_BOT = DEBUG.PLACE_ROID_ON_BOT;
export const DEBUG_PLACE_REMOTE_PLAYERS_NEAR_EACH_OTHER =
  DEBUG.PLACE_REMOTE_PLAYERS_NEAR_EACH_OTHER;
