export const FPS = 60; // Frames per second
export const TURN_SPEED = 240; // turn speed in degrees per second
export const START_LEVEL = 0;
export const START_LIVES = 3;
export const FRICTION = 0; // Friction coefficient (0 = no friction, 1 = a lot of friction)
export const SHIP_THRUST = 5; // Thrust speed in pixels per second per second (Acceleration)
export const SHIP_SIZE = 30; // ship height in pixels
export const SHIP_EXPLODE_DUR = 0.3; // Ship explode time in seconds
export const SHIP_INV_DUR = 3; // Length of time ship is invulnerable in seconds
export const SHIP_INV_BLINK_DUR = 0.1; // length of time between blinks when ship is invulnerable

export const LASER_SPEED = 300; //How fast the laser moves in pixels per second
export const LASER_MAX = 10 // Upper limit of how many lasers can be on screen at any given time
export const LASER_DIST = 0.6 // The max distance a laser can travel as fraction of screen width
export const LASER_EXPLODE_DUR = 0.1 // Laser explode time in seconds

export const DEBUG = false // Show extra features like collision boundaries and ship center dot
export const TEXT_FADE_TIME = 2.5; // text fade in seconds
export const TEXT_SIZE = 40; // Text font height in pixels
export const SAVE_KEY_SCORE = "highscore"; // Save key for localstorage of high score.

export const SOUND_ON = true;
export const MUSIC_ON = false;
export const STARTING_SCORE = 0;

export const ROID_NUM = 1; // starting number of asteroids
export const ROID_SPEED = 50; // starting asteroid max speed in pixels per second
export const ROID_SIZE = 50; // startin size of asteroids in pixels
export const ROID_VERTICES = 10; // average number of vertices on each asteroid
export const ROID_JAGG = 0.5; // The jaggedness of the asteroids (0 = smooth, 1 = very jagged)
export const ROID_POINTS_LRG = 20 // points for a large asteroid 
export const ROID_POINTS_MED = 50 // points for a medium asteroid 
export const ROID_POINTS_SML = 100 // points for a small asteroid 

export const SPEED_OF_LIGHT = 30