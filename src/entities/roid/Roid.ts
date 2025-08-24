import type { Position, Velocity } from '../../../shared-types';
import { Sound } from '../../audio/Sound';
import {
  ROID_JAGG,
  ROID_POINTS_LRG,
  ROID_POINTS_MED,
  ROID_POINTS_SML,
  ROID_SIZE,
  ROID_SPEED,
  ROID_VERTICES,
} from '../../constants/entities/roid';
import { FPS, ROID_MAX_COUNT, ROID_MIN_COUNT, ROID_NUM } from '../../constants/game';
import { spawnRoidFromEdge } from './roidUtils';

class Roid {
  angle: number;
  readonly offsets: number[] = [];
  vertices: number;
  velocity: Velocity;
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Position,
    public r: number
  ) {
    this.angle = Math.random() * Math.PI * 2; // in radians
    const speed = (Math.random() * ROID_SPEED) / FPS;
    this.velocity = {
      x: speed * (Math.random() < 0.5 ? 1 : -1),
      y: speed * (Math.random() < 0.5 ? 1 : -1),
    };

    this.vertices = Math.floor(Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2);

    for (let i = 0; i < this.vertices; i++) {
      this.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
    }
  }
}

class RoidBelt {
  roidNum = ROID_NUM;
  roids: Roid[] = [];
  minCount = ROID_MIN_COUNT;
  maxCount = ROID_MAX_COUNT;

  constructor() {
    // Create the base number of roids
    for (let i = 0; i < this.roidNum; i++) {
      this.addRoid();
    }
  }

  addRoid(): void {
    const roidPosition = spawnRoidFromEdge();
    this.roids.push(new Roid(roidPosition, Math.ceil(ROID_SIZE / 2)));
  }

  destroyRoid(i: number): number {
    const roids = this.roids;
    const r = roids[i];
    let score = 0;

    // split the roid if applicable, respecting max count
    if (r.r === Math.ceil(ROID_SIZE / 2)) {
      // large roid - only split if we're under the max limit
      if (roids.length + 2 <= this.maxCount) {
        roids.push(new Roid(r.position, Math.ceil(ROID_SIZE / 4)));
        roids.push(new Roid(r.position, Math.ceil(ROID_SIZE / 4)));
      }
      score += ROID_POINTS_LRG;
    } else if (r.r === Math.ceil(ROID_SIZE / 4)) {
      // medium roid - only split if we're under the max limit
      if (roids.length + 2 <= this.maxCount) {
        roids.push(new Roid(r.position, Math.ceil(ROID_SIZE / 8)));
        roids.push(new Roid(r.position, Math.ceil(ROID_SIZE / 8)));
      }
      score += ROID_POINTS_MED;
    } else {
      // small roid - no splitting, just destroy
      score += ROID_POINTS_SML;
    }

    roids.splice(i, 1);
    return score;
  }

  getRoids(): Roid[] {
    return this.roids;
  }

  moveRoids(): void {
    for (const roid of this.roids) {
      // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
      // let dt = 1/Math.sqrt(1-beta_squared)
      roid.position = {
        x: roid.position.x + roid.velocity.x,
        y: roid.position.y + roid.velocity.y,
      };
    }
  }

  spawnRoids(): void {
    // Only spawn if we're below minimum count and under maximum limit
    if (this.roids.length < this.minCount && this.roids.length < this.maxCount) {
      const neededCount = Math.min(
        this.minCount - this.roids.length, // How many we need to reach minimum
        this.maxCount - this.roids.length // How many we can add without exceeding maximum
      );

      // Spawn the needed roids
      for (let i = 0; i < neededCount; i++) {
        this.addRoid();
      }
    }
  }

  // Method to set custom min/max counts (useful for debug mode)
  setRoidLimits(minCount: number, maxCount: number): void {
    this.minCount = Math.max(0, minCount);
    this.maxCount = Math.max(this.minCount, maxCount);
  }
}

export { RoidBelt, Roid };

export function createRoidBelt(): RoidBelt {
  return new RoidBelt();
}
