import {distBetweenPoints} from './utils.js';
import {updateScores, getCurrentLevel} from './scoreLevelLives.js';
import {
  ROID_NUM,
  ROID_SIZE,
  ROID_SPEED,
  FPS,
  ROID_VERTICES,
  ROID_JAGG,
  ROID_POINTS_LRG,
  ROID_POINTS_MED,
  ROID_POINTS_SML,
  DEBUG,
  CTX,
  CVS,
} from './constants.js';
import {Ship, ship} from './ship.js';

let roid: {
  x: number,
  y: number,
  t: number,
  xv:number,
  yv:number,
  a:number,
  r:number,
  offsets: number[],
  vertices: number
};

let roids: typeof roid[];

let roidsTotal: number;
let roidsLeft: number;
/**
 *
 * @param x - X coordinate of the Asteroid.
 * @param y - Y coordinate of the Asteroid
 * @param r - Astroid radius in pixels
 * @returns Asteroid
 */
function newAsteroid(x:number, y:number, r:number) {
  const level = getCurrentLevel();
  const lvlMult = 1 + 0.1 * level;

  roid = {
    x: x,
    y: y,
    t: 0,
    xv:
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    yv:
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    a: Math.random() * Math.PI * 2, // in radians
    r: r,
    offsets: [],
    vertices: Math.floor(
        Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2,
    ),
  };
  for (let i = 0; i < roid.vertices; i++) {
    roid.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
  }

  return roid;
}
/**
 *
 * @returns Array of Asteroids
 */
function getRoidsInfo() {
  return {roids: roids, roidsLeft: roidsLeft, roidsTotal: roidsTotal};
}
/**
 *
 * @returns Array of Asteroids
 */
function createAsteroidBelt() {
  const currentLevel = getCurrentLevel();
  roids = [];
  roidsTotal = (ROID_NUM + currentLevel) * 7;
  roidsLeft = roidsTotal;
  let x;
  let y;
  for (let i = 0; i < ROID_NUM + currentLevel; i++) {
    // random asteroid location (not touching ship)
    do {
      x = Math.floor(Math.random() * CVS.width);
      y = Math.floor(Math.random() * CVS.height);
    } while (distBetweenPoints(ship.x, ship.y, x, y) < ROID_SIZE * 2 + ship.r);
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 2)));
  }
  return {roids: roids, roidsLeft: roidsLeft, roidsTotal: roidsTotal};
}
/**
 *
 * @param i - index of asteroid to be removed
 *
 * @param roids - Array of Asteroids
 */
function destroyAsteroid(i:number, roids: typeof roid[]) {
  const x = roids[i].x;
  const y = roids[i].y;
  const r = roids[i].r;
  let score = 0;

  // split the asteroid if applicable
  if (r == Math.ceil(ROID_SIZE / 2)) {
    // large asteroid
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 4)));
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 4)));
    score += ROID_POINTS_LRG;
  } else if (r == Math.ceil(ROID_SIZE / 4)) {
    // medium asteroid
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 8)));
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 8)));
    score += ROID_POINTS_MED;
    // small asteroid
  } else {
    score += ROID_POINTS_SML;
  }
  updateScores(score);
  roids.splice(i, 1);
  roidsLeft--;
}

let x;
let y;
let r;
let a;
let vertices;
let offsets;
/**
 * Draws astroids on the canvas from an array of Asteroids
 */
function drawAsteroids() {
  for (let i = 0; i < roids.length; i++) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    x = roids[i].x;
    y = roids[i].y;
    r = roids[i].r;
    a = roids[i].a;
    vertices = roids[i].vertices;
    offsets = roids[i].offsets;
    // draw a path
    CTX.beginPath();
    CTX.moveTo(
        x + r * offsets[0] * Math.cos(a),
        y + r * offsets[0] * Math.sin(a),
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      CTX.lineTo(
          x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
          y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices),
      );
    }
    CTX.closePath();
    CTX.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      CTX.strokeStyle = 'lime';
      CTX.beginPath();
      CTX.arc(x, y, r, 0, Math.PI * 2, false);
      CTX.stroke();
    }
  }
}
/**
 *
 * @param ship - A Ship object
 */
function drawAsteroidsRelative(ship: Ship) {
  for (let i = 0; i < roids.length; i++) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    x = CVS.width / 2 - ship.x + roids[i].x;
    y = CVS.height / 2 - ship.y + roids[i].y;
    r = roids[i].r;
    a = roids[i].a;
    vertices = roids[i].vertices;
    offsets = roids[i].offsets;
    // draw a path
    CTX.beginPath();
    CTX.moveTo(
        x + r * offsets[0] * Math.cos(a),
        y + r * offsets[0] * Math.sin(a),
    );
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      CTX.lineTo(
          x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices),
          y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices),
      );
    }
    CTX.closePath();
    CTX.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      CTX.strokeStyle = 'lime';
      CTX.beginPath();
      CTX.arc(x, y, r, 0, Math.PI * 2, false);
      CTX.stroke();
    }
  }
}
/**
 * Move all asteroids in an array using their x and y velocity
 */
function moveAsteroids() {
  for (let i = 0; i < roids.length; i++) {
    // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
    // let dt = 1/Math.sqrt(1-beta_squared)
    roids[i].x += roids[i].xv;
    roids[i].y += roids[i].yv;
}
}

export {
  createAsteroidBelt,
  destroyAsteroid,
  drawAsteroids,
  drawAsteroidsRelative,
  getRoidsInfo,
  moveAsteroids,
};
