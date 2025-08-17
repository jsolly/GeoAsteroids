export const START_LEVEL = 1;
export const START_LIVES = 3;
export const STARTING_SCORE = 0;
export const NEXT_LEVEL_POINTS = 1000;

export const DEBUG =
  (import.meta.env.VITE_DEBUG === 'true' || import.meta.env.MODE === 'development') &&
  import.meta.env.VITE_INVINCIBLE === 'true';

export const SHOW_COLLISION_CIRCLES = false; // Set to false to hide collision circles while keeping debug mode

export const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED !== 'false'; // Enable multiplayer by default, can be disabled with VITE_MULTIPLAYER_ENABLED=false
export const WEBSOCKET_ENABLED = import.meta.env.VITE_WEBSOCKET_ENABLED !== 'false'; // Enable WebSocket by default, can be disabled with VITE_WEBSOCKET_ENABLED=false

// Feature flags
export const DRAW_ASTEROIDS = import.meta.env.VITE_DRAW_ASTEROIDS !== 'false';

export const SAVE_KEY_PERSONAL_BEST = 'personal_best'; // localstorage of the user's personal best score.

/* EMP Pulse Constants*/
export const EMP_PULSE_RADIUS = 250; // EMP pulse radius in pixels (focused size)
export const EMP_PULSE_DURATION = 0.5; // EMP pulse visual duration in seconds
export const EMP_PULSE_COOLDOWN = 3.0; // EMP pulse cooldown in seconds (normal mode)

export enum Difficulty {
  easy,
  medium,
  hard,
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
