import { distBetweenPoints, Point } from './utils.js';
import { updateScores, getCurrentLevel } from './scoreLevelLives.js';
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
import { Ship } from './ship.js';

class Roid {
  readonly a: number;
  readonly offsets: number[] = [];
  readonly vertices: number;
  xv: number;
  yv: number;

  constructor(public centroid: Point, public r: number) {
    const level = getCurrentLevel();
    const lvlMult = 1 + 0.1 * level;
    this.a = Math.random() * Math.PI * 2; // in radians
    this.xv =
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1);

    this.yv =
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1);

    this.vertices = Math.floor(
      Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2,
    );

    for (let i = 0; i < this.vertices; i++) {
      this.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
    }
  }
}

class asteroidBelt {
  roids: Roid[] = [];
  private currentLevel = getCurrentLevel();
  constructor(ship: Ship) {
    for (let i = 0; i < ROID_NUM + this.currentLevel; i++) {
      let astroidCentroid: Point;
      do {
        const x = Math.floor(Math.random() * CVS.width);
        const y = Math.floor(Math.random() * CVS.height);
        astroidCentroid = new Point(x, y);
      } while (
        distBetweenPoints(ship.centroid, astroidCentroid) <
        ROID_SIZE * 2 + ship.r
      );
      this.roids.push(new Roid(astroidCentroid, Math.ceil(ROID_SIZE / 2)));
    }
  }
}

/**
 *
 * @param i - index of asteroid to be removed
 *
 * @param roids - Array of Asteroids
 */
function destroyAsteroid(i: number, roids: Roid[]): void {
  const r = roids[i].r;
  let score = 0;

  // split the asteroid if applicable
  if (r == Math.ceil(ROID_SIZE / 2)) {
    // large asteroid
    roids.push(new Roid(roids[i].centroid, Math.ceil(ROID_SIZE / 4)));
    roids.push(new Roid(roids[i].centroid, Math.ceil(ROID_SIZE / 4)));
    score += ROID_POINTS_LRG;
  } else if (r == Math.ceil(ROID_SIZE / 4)) {
    // medium asteroid
    roids.push(new Roid(roids[i].centroid, Math.ceil(ROID_SIZE / 8)));
    roids.push(new Roid(roids[i].centroid, Math.ceil(ROID_SIZE / 8)));
    score += ROID_POINTS_MED;
    // small asteroid
  } else {
    score += ROID_POINTS_SML;
  }
  updateScores(score);
  roids.splice(i, 1);
}
/**
 * Draws astroids on the canvas from an array of Asteroids
 */
function drawAsteroids(roids: Roid[]): void {
  for (const roid of roids) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    const x = roid.centroid.x;
    const y = roid.centroid.y;
    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
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
function drawAsteroidsRelative(ship: Ship, roids: Roid[]): void {
  for (const roid of roids) {
    CTX.strokeStyle = 'slategrey';
    CTX.lineWidth = 1.5;
    // get asteroid properties
    const x = CVS.width / 2 - ship.centroid.x + roid.centroid.x;
    const y = CVS.height / 2 - ship.centroid.y + roid.centroid.y;
    const r = roid.r;
    const a = roid.a;
    const vertices = roid.vertices;
    const offsets = roid.offsets;
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
function moveAsteroids(roids: Roid[]): void {
  for (const roid of roids) {
    // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
    // let dt = 1/Math.sqrt(1-beta_squared)
    roid.centroid = new Point(
      roid.centroid.x + roid.xv,
      roid.centroid.y + roid.yv,
    );
  }
}

export {
  destroyAsteroid,
  drawAsteroids,
  drawAsteroidsRelative,
  moveAsteroids,
  asteroidBelt,
  Roid,
};
