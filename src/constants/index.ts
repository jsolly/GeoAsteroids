/**
 * Unified Constants - Consolidated from all constant files
 * Organized by domain for better maintainability
 */

import { getStoredItem } from '../utils/safeStorage';

// ============================================================================
// GAME CONFIGURATION
// ============================================================================
export const GAME = {
  // Lives and scoring
  START_LIVES: 3,
  STARTING_SCORE: 0,

  // Network (can be overridden by DEBUG.BOT_PLAYER.COUNT when in debug mode)
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
// LOCKED PLAYFIELD PALETTE
// ============================================================================
// Exact hexes for the visual pass. accent_ui is title/menu only — never the playfield.
export const PALETTE = {
  BG: '#000011',
  STARS: '#8BA3C7',
  LOCAL: '#5EEAD4',
  REMOTE: '#7DD3FC',
  BOT: '#FB923C',
  ROID: '#94A3B8',
  LASER_LOCAL: '#FDE68A',
  LASER_ENEMY: '#FCA5A5',
  HUD: '#E2E8F0',
  HUD_MUTED: '#64748B',
  DANGER: '#F43F5E',
  HEALTH: '#4ADE80',
  ACCENT_UI: '#A78BFA',
} as const;

// Stroke / glow caps. Soft glow must stay ≤ stroke width so beams cannot wash the field.
export const VISUAL = {
  SHIP_STROKE_WIDTH: 1.5,
  SHIP_GLOW: 1.5,
  // Classic Atari shot: a short hard-edged segment along the heading, not a beam or disc.
  LASER_STROKE_WIDTH: 2,
  LASER_LENGTH: 4,
  LASER_EXPLODE_RADIUS: 4,
  LASER_GLOW: 2,
  HEALTH_CAPSULE_HEIGHT: 2,
  BOUNDARY_STROKE_WIDTH: 1.25,
  BOUNDARY_GLOW: 1.25,
  ROID_STROKE_LARGE: 2.25,
  ROID_STROKE_MEDIUM: 1.5,
  ROID_STROKE_SMALL: 1,
  MINIMAP_SIZE: 96,
  MINIMAP_DOT: 3,
  THRUSTER_LENGTH_RATIO: 0.65,
  SCORE_FONT: '12px Arial',
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
  HEALTH_REGEN_RATE: 1, // per second
  HEALTH_REGEN_DELAY: 5, // seconds

  // Timing (in frames at 60 FPS)
  EXPLODE_DURATION_FRAMES: 18, // 0.3 seconds
  INVINCIBILITY_DURATION_FRAMES: 180, // 3 seconds
  INVINCIBILITY_BLINK_DURATION_FRAMES: 6, // 0.1 seconds
} as const;

// ============================================================================
// DAMAGE CONFIGURATION
// ============================================================================
export const DAMAGE = {
  // Instant damage (applied immediately)
  LASER_HIT: 25, // Damage dealt by a single laser hit
  BOUNDARY_COLLISION: 100, // Instant kill when hitting game boundary

  // Damage over time (applied per second while colliding)
  PLAYER_COLLISION_PER_SECOND: 20, // Damage per second when colliding with another player

  // Damage intervals (calculated from DPS)
  PLAYER_COLLISION_INTERVAL_MS: 50, // 1000ms / 20 DPS = 50ms per damage tick
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

  // Spawning (can be overridden by DEBUG.ROIDS.INITIAL_COUNT when in debug mode)
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
// AUDIO CONFIGURATION
// ============================================================================
export const AUDIO = {
  EXPLOSION_PATH: 'sounds/explode.m4a',
  EXPLOSION_MAX_STREAMS: 5,
  // Used when the canvas size is unknown (matches PlayerNetwork nearby radius).
  FALLBACK_MAX_DISTANCE: 1200,
  // Floor so an on-screen explosion at the viewport edge stays audible.
  MIN_IN_VIEWPORT_VOLUME: 0.2,
} as const;

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================
export const DEBUG = {
  // Master switch for debug features. Off in the default play path so yellow
  // DEBUG MODE chrome does not paint in production builds.
  ENABLED: false,

  // Local player settings
  LOCAL_PLAYER: {
    INVINCIBLE: false,
    SPAWN_PROTECTION: true,
  },

  // Remote player settings
  REMOTE_PLAYER: {
    // Add remote player specific settings here as needed
  },

  // Bot player settings
  BOT_PLAYER: {
    COUNT: 2, // Reduced for better performance during development (overrides GAME.BOT_COUNT when in debug mode)
    MOVEMENT: true,
    LASERS: true,
    SPAWN_PROTECTION: false,
  },

  // Roid settings (overrides ROID.INITIAL_ROID_COUNT when in debug mode)
  ROIDS: {
    INITIAL_COUNT: 20, // Overrides ROID.INITIAL_ROID_COUNT
    MOVEMENT: false,
    PLACE_ON_BOT: false,
    PLACE_ON_LOCAL_PLAYER: false,
    ALL_LARGE: true, // Force all generated roids to be large size
  },

  // Player positioning settings (Affects local, remote, and bot players)
  PLACE_PLAYERS_NEAR_CENTER: false,
  PLACE_PLAYERS_NEAR_BOUNDARY: false,
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
  WRITE_TO_CONSOLE: true,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
export const isSoundEnabled = (): boolean =>
  getStoredItem(PREFERENCES.LOCAL_STORAGE_KEYS.SOUND_ON) === 'true';

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
