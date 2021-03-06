/* Physics Constants*/
export const FPS = 60; // Frames per second
export const SPEED_OF_LIGHT = 30;
export const FRICTION = 0; // Friction coefficient from 0 (none) to 1 (a lot)

/* Ship Constants*/
export const TURN_SPEED = 240; // turn speed in degrees per second
export const START_LEVEL = 0;
export const START_LIVES = 3;
export const SHIP_THRUST = 5; // Thrust in pixels/second/second (Acceleration)
export const SHIP_SIZE = 30; // ship height in pixels
export const SHIP_EXPLODE_DUR = 0.3; // Ship explode time in seconds
export const SHIP_INV_DUR = 3; // Length of time ship is invulnerable in seconds
export const SHIP_INV_BLINK_DUR = 0.1;
// Time between blinks when ship is invulnerable

/* Laser Constants*/
export const LASER_SPEED = 300; // How fast the laser moves in pixels per second
export const LASER_MAX = 10; // limit of how many lasers can exist at once.
export const LASER_DIST = 0.6;
// Distance of laser travel as fraction of screen width
export const LASER_EXPLODE_DUR = 0.1; // Laser explode time in seconds

/* Asteroid Constants*/
export const ROID_NUM = 1; // starting number of asteroids
export const ROID_SPEED = 50; // starting asteroid speed in pixels per second
export const ROID_SIZE = 50; // startin size of asteroids in pixels
export const ROID_VERTICES = 10; // average number of vertices on each asteroid
export const ROID_JAGG = 0.5; // Asteroid jaggedness (0 = smooth, 1 = jagged)
export const ROID_POINTS_LRG = 20; // points for a large asteroid
export const ROID_POINTS_MED = 50; // points for a medium asteroid
export const ROID_POINTS_SML = 100; // points for a small asteroid

/* Game Settings Constants*/
export const STARTING_SCORE = 0;
export const DEBUG = false; // Show ship collision boundary and ship center dot
export const SAVE_KEY_HIGH_SCORE = 'highscore'; // localstorage of high score.
export const SAVE_KEY_SOUND_ON = 'musicOn'; // localstorage of high score.
export const SAVE_KEY_MUSIC_ON = 'soundOn'; // localstorage of high score.
