import {
  ROID_SIZE,
  ROID_SPEED,
  FPS,
  ROID_VERTICES,
  ROID_JAGG,
  ROID_POINTS_LRG,
  ROID_POINTS_MED,
  ROID_POINTS_SML,
  ROID_SPAWN_TIME,
  getRoidNum,
} from './config.js';
import { Sound } from './soundsMusic';
import { Point } from './utils';
import { Ship } from './ship';

interface IRoid {
  readonly a: number;
  readonly offsets: number[];
  readonly vertices: number;
  xv: number;
  yv: number;
  centroid: Point;
  r: number;
}
class Roid implements IRoid {
  readonly a: number;
  readonly offsets: number[] = [];
  readonly vertices: number;
  xv: number;
  yv: number;
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(public centroid: Point, public r: number) {
    const currLevel = 0;
    const lvlMult = 1 + 0.1 * currLevel;
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

interface IRoidBelt {
  roidNum: number;
  roids: Roid[];
  spawnTime: number;
}

class RoidBelt implements IRoidBelt {
  roidNum = getRoidNum();
  roids: Roid[] = [];
  spawnTime: number = Math.ceil(ROID_SPAWN_TIME * FPS);
  constructor(ship: Ship) {
    for (let i = 0; i < this.roidNum; i++) {
      this.addRoid(ship);
    }
  }
  addRoid(ship: Ship): void {
    const x =
      ship.centroid.x +
      (ROID_SIZE * 4 + ship.r) * (Math.random() < 0.5 ? 1 : -1); // 50% chance of True or False
    const y =
      ship.centroid.y +
      (ROID_SIZE * 4 + ship.r) * (Math.random() < 0.5 ? 1 : -1);
    const astroidCentroid = new Point(x, y);
    this.roids.push(new Roid(astroidCentroid, Math.ceil(ROID_SIZE / 2)));
  }
  destroyRoid(i: number): number {
    const roids = this.roids;
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

    roids.splice(i, 1);
    return score;
  }

  /**
   * Move all asteroids in an array using their x and y velocity
   */
  moveRoids(): void {
    for (const roid of this.roids) {
      // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
      // let dt = 1/Math.sqrt(1-beta_squared)
      roid.centroid = new Point(
        roid.centroid.x + roid.xv,
        roid.centroid.y + roid.yv,
      );
    }
  }
  spawnRoids(ship: Ship): void {
    if (this.spawnTime == 0) {
      for (let i = 0; i < 4; i++) {
        this.addRoid(ship);
        this.spawnTime = ROID_SPAWN_TIME * FPS;
      }
    }
    this.spawnTime--;
  }
}

export { RoidBelt, Roid };
