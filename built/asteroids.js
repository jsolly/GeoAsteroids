import {distBetweenPoints} from './utils.js';
import {updateScores, getCurrentLevel} from './scoreLevelLives.js';
import {ROID_NUM, ROID_SIZE, ROID_SPEED, FPS, ROID_VERTICES, ROID_JAGG, ROID_POINTS_LRG, ROID_POINTS_MED, ROID_POINTS_SML, DEBUG} from './constants.js';
import {ship} from './ship.js';
import {getCanvConsts} from './canvas.js';
const {cvs, ctx} = getCanvConsts();
let roids;
let roidsTotal;
let roidsLeft;
/**
 *
 * @param {number} x - X coordinate of the Asteroid.
 * @param {number} y - Y coordinate of the Asteroid
 * @param {number} r - Astroid radius in pixels
 * @return {[Object]} Asteroid
 */
function newAsteroid(x, y, r) {
  const level = getCurrentLevel();
  const lvlMult = 1 + 0.1 * level;
  const roid = {
    x: x,
    y: y,
    t: 0,
    xv: ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
            (Math.random() < 0.5 ? 1 : -1),
    yv: ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
            (Math.random() < 0.5 ? 1 : -1),
    a: Math.random() * Math.PI * 2,
    r: r,
    offsets: [],
    vertices: Math.floor(Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2),
  };
  for (let i = 0; i < roid.vertices; i++) {
    roid.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
  }
  return roid;
}
/**
 *
 * @return {[Array]} Array of Asteroids
 */
function getRoidsInfo() {
  return {roids: roids, roidsLeft: roidsLeft, roidsTotal: roidsTotal};
}
/**
 *
 * @return {[Array]} Array of Asteroids
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
      x = Math.floor(Math.random() * cvs.width);
      y = Math.floor(Math.random() * cvs.height);
    } while (distBetweenPoints(ship.x, ship.y, x, y) < ROID_SIZE * 2 + ship.r);
    roids.push(newAsteroid(x, y, Math.ceil(ROID_SIZE / 2)));
  }
  return {roids: roids, roidsLeft: roidsLeft, roidsTotal: roidsTotal};
}
/**
 *
 * @param {number} i - index of asteroid to be removed
 *
 * @param {Array} roids - Array of Asteroids
 */
function destroyAsteroid(i, roids) {
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
    ctx.strokeStyle = 'slategrey';
    ctx.lineWidth = 1.5;
    // get asteroid properties
    x = roids[i].x;
    y = roids[i].y;
    r = roids[i].r;
    a = roids[i].a;
    vertices = roids[i].vertices;
    offsets = roids[i].offsets;
    // draw a path
    ctx.beginPath();
    ctx.moveTo(x + r * offsets[0] * Math.cos(a), y + r * offsets[0] * Math.sin(a));
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      ctx.lineTo(x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices), y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices));
    }
    ctx.closePath();
    ctx.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      ctx.strokeStyle = 'lime';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }
}
/**
 *
 * @param {Ship} ship
 */
function drawAsteroidsRelative(ship) {
  for (let i = 0; i < roids.length; i++) {
    ctx.strokeStyle = 'slategrey';
    ctx.lineWidth = 1.5;
    // get asteroid properties
    x = -(ship.x - cvs.width / 2) + roids[i].x;
    y = -(ship.y - cvs.height / 2) + roids[i].y;
    r = roids[i].r;
    a = roids[i].a;
    vertices = roids[i].vertices;
    offsets = roids[i].offsets;
    // draw a path
    ctx.beginPath();
    ctx.moveTo(x + r * offsets[0] * Math.cos(a), y + r * offsets[0] * Math.sin(a));
    // draw the polygon
    for (let j = 1; j < vertices; j++) {
      ctx.lineTo(x + r * offsets[j] * Math.cos(a + (j * Math.PI * 2) / vertices), y + r * offsets[j] * Math.sin(a + (j * Math.PI * 2) / vertices));
    }
    ctx.closePath();
    ctx.stroke();
    // show asteroid's collision circle
    if (DEBUG) {
      ctx.strokeStyle = 'lime';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }
}
/**
 * Move all asteroids in an array using their x and y velocity
 */
function moveAsteroids() {
  // const cvs = getCanv();
  // ;
  for (let i = 0; i < roids.length; i++) {
    // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
    // let dt = 1/Math.sqrt(1-beta_squared)
    roids[i].x += roids[i].xv;
    roids[i].y += roids[i].yv;
    // handle edge of screen
    // if (roids[i].x < 0 - roids[i].r) {
    //     roids[i].x = cvs.width + roids[i].r;
    // } else if (roids[i].x > cvs.width + roids[i].r) {
    //     roids[i].x = 0 + roids[i].r;
    // }
    // if (roids[i].y < 0 - roids[i].r) {
    //     roids[i].y = cvs.height + roids[i].r;
    // } else if (roids[i].y > cvs.height + roids[i].r) {
    //     roids[i].y = 0 + roids[i].r;
    // }
  }
}
export {createAsteroidBelt, destroyAsteroid, drawAsteroids, drawAsteroidsRelative, getRoidsInfo, moveAsteroids};
