export const LOCAL_STORAGE_KEYS = {
  soundOn: 'soundOn',
  musicOn: 'musicOn',
};

/* Preferences from Localstorage */

export function soundIsOn(): boolean {
  const soundPref = localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn);
  return soundPref === 'true';
}

export function musicIsOn(): boolean {
  const musicPref = localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn);
  return musicPref === 'true';
}

const defaultSoundPref = document.getElementById(
  'soundPref',
) as HTMLInputElement;

const defaultMusicPref = document.getElementById(
  'musicPref',
) as HTMLInputElement;

if (soundIsOn()) {
  defaultSoundPref.checked = true;
}

if (musicIsOn()) {
  defaultMusicPref.checked = true;
}

/* Physics Constants*/
export const FPS = 60; // Frames per second
export const SPEED_OF_LIGHT = 30; // pixels per second
export const FRICTION = 0.6; // Friction coefficient from 0 (none) to 1 (a lot)

/* Ship Constants*/
export const TURN_SPEED = 450; // turn speed in degrees per second
export const START_LEVEL = 1;
export const START_LIVES = 3;
export const SHIP_THRUST = 5; // Thrust in pixels per second per second (Acceleration)
export const SHIP_SIZE = 30; // ship height in pixels
export const SHIP_EXPLODE_DUR = 0.3; // Ship explode time in seconds
export const SHIP_INV_DUR = 3; // Length of time ship is invulnerable in seconds
export const SHIP_INV_BLINK_DUR = 0.1;
// Time between blinks when ship is invulnerable

/* Laser Constants*/
export const LASER_SPEED = 300; // How fast the laser moves in pixels per second
export const LASER_MAX = 200; // limit of how many lasers can exist at once.
export const LASER_DIST = 0.6;
// Distance of laser travel as fraction of screen width
export const LASER_EXPLODE_DUR = 0.1; // Laser explode time in seconds

/* Asteroid Constants*/
export const ROID_SPEED = 50; // starting asteroid speed in pixels per second
export const ROID_SIZE = 50; // startin size of asteroids in pixels
export const ROID_VERTICES = 10; // average number of vertices on each asteroid
export const ROID_JAGG = 0.5; // Asteroid jaggedness (0 = smooth, 1 = jagged)
export const ROID_POINTS_LRG = 20; // points for a large asteroid
export const ROID_POINTS_MED = 50; // points for a medium asteroid
export const ROID_POINTS_SML = 100; // points for a small asteroid
export const ROID_SPAWN_TIME = 1; // One asteroid every three seconds

/* Game Settings Constants*/
export const STARTING_SCORE = 0;
export const DEBUG =
  (import.meta.env.VITE_DEBUG === 'true' ||
    import.meta.env.MODE === 'development') &&
  import.meta.env.VITE_INVINCIBLE === 'true';
export const SHOW_COLLISION_CIRCLES = false; // Set to false to hide collision circles while keeping debug mode
export const MULTIPLAYER_DEBUG =
  import.meta.env.VITE_MULTIPLAYER_DEBUG === 'true' || DEBUG; // Show multiplayer debug info
export const SAVE_KEY_PERSONAL_BEST = 'personal_best'; // localstorage of the user's personal best score.
export const NEXT_LEVEL_POINTS = 1000;

/* EMP Pulse Constants*/
export const EMP_PULSE_RADIUS = 250; // EMP pulse radius in pixels (focused size)
export const EMP_PULSE_DURATION = 0.5; // EMP pulse visual duration in seconds
export const EMP_PULSE_COOLDOWN = 3.0; // EMP pulse cooldown in seconds (normal mode)

/* Drawing Constants*/
export const TEXT_SIZE = 40; // Text font height in pixels
export const TEXT_FADE_TIME = 2.5; // text fade in seconds.

// Canvas setup with proper scaling
export const CVS = document.querySelector('canvas');
export const CTX = CVS?.getContext('2d');

// Safe accessor functions for canvas and context
export function getCVS(): HTMLCanvasElement | null {
  return CVS;
}

export function getCTX(): CanvasRenderingContext2D | null {
  return CTX || null;
}

export function requireCVS(): HTMLCanvasElement {
  if (!CVS) {
    throw new Error('Canvas not initialized');
  }
  return CVS;
}

export function requireCTX(): CanvasRenderingContext2D {
  if (!CTX) {
    throw new Error('Canvas context not initialized');
  }
  return CTX;
}

// Set the internal canvas resolution (this is what the game logic uses)
export const CANVAS_INTERNAL_WIDTH = 800;
export const CANVAS_INTERNAL_HEIGHT = 600;

// Initialize canvas with proper scaling
export function initializeCanvas(): void {
  if (CVS && CTX) {
    // Get the viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Set the internal resolution to match the viewport (what the game logic uses)
    CVS.width = viewportWidth;
    CVS.height = viewportHeight;

    // Enable crisp pixel rendering
    CTX.imageSmoothingEnabled = false;
    CTX.imageSmoothingQuality = 'high';

    // Add resize handler to maintain full-screen coverage
    window.addEventListener('resize', handleCanvasResize);

    // Initial resize call
    handleCanvasResize();
  }
}

// Handle canvas resizing to maintain full-screen coverage
function handleCanvasResize(): void {
  if (CVS && CTX) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Update internal resolution to match new viewport size
    CVS.width = viewportWidth;
    CVS.height = viewportHeight;

    // Re-enable crisp rendering after resize
    CTX.imageSmoothingEnabled = false;
    CTX.imageSmoothingQuality = 'high';
  }
}

// Coordinate scaling utilities for dynamic canvas sizes
export function getCanvasScaleX(): number {
  return CVS ? CVS.width / CANVAS_INTERNAL_WIDTH : 1;
}

export function getCanvasScaleY(): number {
  return CVS ? CVS.height / CANVAS_INTERNAL_HEIGHT : 1;
}

export function scaleX(x: number): number {
  return x * getCanvasScaleX();
}

export function scaleY(y: number): number {
  return y * getCanvasScaleY();
}

export function getCanvasCenter(): { x: number; y: number } {
  return {
    x: CVS ? CVS.width / 2 : 400,
    y: CVS ? CVS.height / 2 : 300,
  };
}

export enum Difficulty {
  'easy',
  'medium',
  'hard',
}

const ROID_NUM_BY_DIFFICULTY: Record<Difficulty, number> = {
  [Difficulty.easy]: 5,
  [Difficulty.medium]: 10,
  [Difficulty.hard]: 50,
};

let difficulty: Difficulty;
export function setDifficulty(newDifficulty: Difficulty): void {
  difficulty = newDifficulty;
}

export function getRoidNum(): number {
  return ROID_NUM_BY_DIFFICULTY[difficulty];
}
