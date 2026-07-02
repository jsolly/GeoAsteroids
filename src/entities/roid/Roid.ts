import type { Position, Velocity } from '../../../shared-types';
import { Sound } from '../../audio/Sound';
import { DEBUG, GAME, ROID } from '../../constants';
import { isDebugMode } from '../../utils/debugUtils';
import { getRandomPositionWithinBoundary } from '../../utils/positionUtils';

class Roid {
  id: string;
  angle: number;
  angularVelocity: number;
  offsets: number[] = [];
  vertices: number;
  velocity: Velocity;
  health: number;
  maxHealth: number;
  pendingDestruction: boolean = false; // Track asteroids waiting for server confirmation
  private _jaggedness: number = ROID.JAGGEDNESS; // Store jaggedness value
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Position,
    public r: number,
    id?: string
  ) {
    this.id = id || crypto.randomUUID();
    this.angle = Math.random() * Math.PI * 2; // in radians
    this.angularVelocity = (Math.random() - 0.5) * 0.01; // Much smaller random rotation
    const speed = (Math.random() * ROID.SPEED) / GAME.FPS;
    this.velocity = {
      x: speed * (Math.random() < 0.5 ? 1 : -1),
      y: speed * (Math.random() < 0.5 ? 1 : -1),
    };

    this.vertices = Math.floor(Math.random() * (ROID.VERTICES + 1) + ROID.VERTICES / 2);
    this.health = this.r * 10; // Health based on size
    this.maxHealth = this.r * 10;

    this.generateShape();
  }

  get jaggedness(): number {
    return this._jaggedness;
  }

  set jaggedness(value: number) {
    this._jaggedness = value;
  }

  // Generate the shape based on current jaggedness
  private generateShape(): void {
    this.offsets.length = 0; // Clear existing offsets
    for (let i = 0; i < this.vertices; i++) {
      this.offsets.push(Math.random() * this._jaggedness * 2 + 1 - this._jaggedness);
    }
  }

  // Regenerate shape (public method for external use)
  regenerateShape(): void {
    this.generateShape();
  }

  // Move the roid based on its velocity
  move(): void {
    this.position = {
      x: this.position.x + this.velocity.x,
      y: this.position.y + this.velocity.y,
    };

    // Update rotation
    this.angle += this.angularVelocity;
  }
}

class RoidBelt {
  roidNum: number = isDebugMode() ? DEBUG.ROIDS.INITIAL_COUNT : ROID.INITIAL_ROID_COUNT;
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
    // Generate random position within boundary since roidSpawn was removed
    const roidPosition = getRandomPositionWithinBoundary();
    const size = DEBUG.ROIDS.ALL_LARGE ? ROID.SIZE : Math.ceil(ROID.SIZE / 2);
    this.roids.push(new Roid(roidPosition, size));
  }

  destroyRoid(i: number): { score: number; newRoids: Roid[] } {
    const roids = this.roids;
    const r = roids[i];
    if (r === undefined) {
      return { score: 0, newRoids: [] };
    }
    let score = 0;

    // Award points based on size (server handles all splitting logic)
    if (r.r >= 40) {
      score += ROID.POINTS_LARGE;
    } else if (r.r >= 20) {
      score += ROID.POINTS_MEDIUM;
    } else {
      score += ROID.POINTS_SMALL;
    }

    // Client never creates new roids - server handles all splitting via network messages
    return { score, newRoids: [] };
  }

  getRoids(): Roid[] {
    return this.roids;
  }

  moveRoids(): void {
    // Check if asteroid movement is disabled in debug mode
    if (!DEBUG.ROIDS.MOVEMENT) {
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
      // Spawn roids until we reach minCount or maxCount
      while (this.roids.length < this.minCount && this.roids.length < this.maxCount) {
        this.addRoid();
      }
      this.spawnTimer = 0; // Reset timer after spawning
    }
  }

  // Method to set custom min/max counts (useful for debug mode)
  setRoidLimits(minCount: number, maxCount: number): void {
    this.minCount = Math.max(0, minCount);
    this.maxCount = Math.max(this.minCount, maxCount);
  }
}

export { Roid, RoidBelt };

export function createRoidBelt(): RoidBelt {
  return new RoidBelt();
}
