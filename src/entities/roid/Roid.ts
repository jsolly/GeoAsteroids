import type { Position, Velocity } from '../../../shared-types';
import { Sound } from '../../audio/Sound';
import { DEBUG, GAME, ROID } from '../../constants';
import { isDebugMode } from '../../utils/debugUtils';
import { spawnRoidFromEdge } from '../../utils/roidSpawn';

class Roid {
  id: string;
  angle: number;
  angularVelocity: number;
  readonly offsets: number[] = [];
  vertices: number;
  velocity: Velocity;
  health: number;
  maxHealth: number;
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Position,
    public r: number
  ) {
    this.id = crypto.randomUUID();
    this.angle = Math.random() * Math.PI * 2; // in radians
    this.angularVelocity = (Math.random() - 0.5) * 0.1; // Small random rotation
    const speed = (Math.random() * ROID.SPEED) / GAME.FPS;
    this.velocity = {
      x: speed * (Math.random() < 0.5 ? 1 : -1),
      y: speed * (Math.random() < 0.5 ? 1 : -1),
    };

    this.vertices = Math.floor(Math.random() * (ROID.VERTICES + 1) + ROID.VERTICES / 2);
    this.health = this.r * 10; // Health based on size
    this.maxHealth = this.r * 10;

    for (let i = 0; i < this.vertices; i++) {
      this.offsets.push(Math.random() * ROID.JAGGEDNESS * 2 + 1 - ROID.JAGGEDNESS);
    }
  }

  get jaggedness(): number {
    return ROID.JAGGEDNESS;
  }
}

class RoidBelt {
  roidNum = isDebugMode() ? DEBUG.INITIAL_ROID_COUNT : ROID.INITIAL_ROID_COUNT;
  roids: Roid[] = [];
  minCount: number = ROID.MIN_COUNT;
  maxCount: number = ROID.MAX_COUNT;
  spawnTimer = 0; // Timer for spawning roids

  constructor(createInitialRoids = true) {
    if (createInitialRoids) {
      // Create the base number of roids
      for (let i = 0; i < this.roidNum; i++) {
        this.addRoid();
      }
    }
  }

  addRoid(): void {
    const roidPosition = spawnRoidFromEdge();
    this.roids.push(new Roid(roidPosition, Math.ceil(ROID.SIZE / 2)));
  }

  destroyRoid(i: number): { score: number; newRoids: Roid[] } {
    const roids = this.roids;
    const r = roids[i];
    let score = 0;
    const newRoids: Roid[] = [];

    // split the roid if applicable, respecting max count
    if (r.r === Math.ceil(ROID.SIZE / 2)) {
      // large roid - only split if we're under the max limit
      if (roids.length + 2 <= this.maxCount) {
        newRoids.push(new Roid(r.position, Math.ceil(ROID.SIZE / 4)));
        newRoids.push(new Roid(r.position, Math.ceil(ROID.SIZE / 4)));
      }
      score += ROID.POINTS_LARGE;
    } else if (r.r === Math.ceil(ROID.SIZE / 4)) {
      // medium roid - only split if we're under the max limit
      if (roids.length + 2 <= this.maxCount) {
        newRoids.push(new Roid(r.position, Math.ceil(ROID.SIZE / 8)));
        newRoids.push(new Roid(r.position, Math.ceil(ROID.SIZE / 8)));
      }
      score += ROID.POINTS_MEDIUM;
    } else {
      // small roid - no splitting, just destroy
      score += ROID.POINTS_SMALL;
    }

    // Note: The caller is responsible for splicing the destroyed roid and adding newRoids
    return { score, newRoids };
  }

  getRoids(): Roid[] {
    return this.roids;
  }

  moveRoids(): void {
    // Check if asteroid movement is disabled in debug mode
    if (DEBUG.DISABLE_ROID_MOVEMENT) {
      return;
    }

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
    // Update spawn timer
    this.spawnTimer++;

    // Only spawn if we're below minimum count, under maximum limit, and timer has elapsed
    if (
      this.roids.length < this.minCount &&
      this.roids.length < this.maxCount &&
      this.spawnTimer >= ROID.SPAWN_TIME_FRAMES
    ) {
      // Spawn one roid at a time with timing
      this.addRoid();
      this.spawnTimer = 0; // Reset timer after spawning
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
