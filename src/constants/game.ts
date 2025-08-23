export const START_LIVES = 3;
export const STARTING_SCORE = 0;

export const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED !== 'false'; // Enable multiplayer by default, can be disabled with VITE_MULTIPLAYER_ENABLED=false

// Bot configuration
export const DEFAULT_BOT_COUNT = 3; // Default number of bots in multiplayer mode

/* EMP Pulse Constants*/
export const EMP_PULSE_RADIUS = 250; // EMP pulse radius in pixels (focused size)
export const EMP_PULSE_DURATION = 0.5; // EMP pulse visual duration in seconds

// Roid configuration - simplified to use constant value
export const ROID_NUM = 10; // Initial number of roids to spawn
export const ROID_MIN_COUNT = 5; // Minimum roids before spawning more
export const ROID_MAX_COUNT = 20; // Maximum roids allowed

// Physics constants
export const FPS = 60; // Frames per second
export const FRICTION = 0.6; // Friction coefficient from 0 (none) to 1 (a lot)
