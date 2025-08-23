export const START_LEVEL = 1;
export const START_LIVES = 3;
export const STARTING_SCORE = 0;
export const NEXT_LEVEL_POINTS = 1000;

export const DEBUG =
  import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'development';

export const SHOW_COLLISION_CIRCLES = false; // Set to false to hide collision circles while keeping debug mode

export const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED !== 'false'; // Enable multiplayer by default, can be disabled with VITE_MULTIPLAYER_ENABLED=false

// Bot configuration
export const DEFAULT_BOT_COUNT = 3; // Default number of bots in multiplayer mode

// Feature flags - now controlled by debug config when in debug mode
export const DRAW_ASTEROIDS = import.meta.env.VITE_DRAW_ASTEROIDS !== 'false';

export const SAVE_KEY_PERSONAL_BEST = 'personal_best'; // localstorage of the user's personal best score.

/* EMP Pulse Constants*/
export const EMP_PULSE_RADIUS = 250; // EMP pulse radius in pixels (focused size)
export const EMP_PULSE_DURATION = 0.5; // EMP pulse visual duration in seconds

// Asteroid configuration - simplified to use constant value
export const ROID_NUM = 10; // Number of asteroids to spawn
