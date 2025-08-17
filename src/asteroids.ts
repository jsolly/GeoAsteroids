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
  DISABLE_ASTEROIDS,
} from './constants.js';
import { Sound } from './soundsMusic';
import { Ship } from './ship';
import { GameController } from './gameController.js';
import { Vector } from './vector.js';

interface IRoid {
  readonly a: number;
  readonly offsets: number[];
  readonly vertices: number;
  velocity: Vector;
  position: Vector;
  r: number;
}
class Roid implements IRoid {
  readonly a: number;
  readonly offsets: number[] = [];
  readonly vertices: number;
  velocity: Vector;
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Vector,
    public r: number,
  ) {
    const currLevel = 0;
    const lvlMult = 1 + 0.1 * currLevel;
    this.a = Math.random() * Math.PI * 2; // in radians
    const speed = (Math.random() * ROID_SPEED * lvlMult) / FPS;
    this.velocity = new Vector(
      speed * (Math.random() < 0.5 ? 1 : -1),
      speed * (Math.random() < 0.5 ? 1 : -1),
    );

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
  private multiplayerAdjusted = false;

  constructor(ship: Ship) {
    // Don't check multiplayer mode during construction to avoid circular dependency
    // The asteroid count will be adjusted later when the game starts

    if (!DISABLE_ASTEROIDS) {
      for (let i = 0; i < this.roidNum; i++) {
        this.addRoid(ship);
      }
    }
  }
  addRoid(ship: Ship): void {
    if (DISABLE_ASTEROIDS) return;
    // Get the current canvas dimensions for full-screen spawning
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    // Spawn asteroids from all edges of the screen
    let x: number, y: number;

    // Randomly choose which edge to spawn from (0-3: top, right, bottom, left)
    const edge = Math.floor(Math.random() * 4);
    let direction: number;

    switch (edge) {
      case 0: // Top edge
        x = Math.random() * canvasWidth;
        y = -ROID_SIZE; // Just above the screen
        break;
      case 1: // Right edge
        x = canvasWidth + ROID_SIZE; // Just right of the screen
        y = Math.random() * canvasHeight;
        break;
      case 2: // Bottom edge
        x = Math.random() * canvasWidth;
        y = canvasHeight + ROID_SIZE; // Just below the screen
        break;
      case 3: // Left edge
        x = -ROID_SIZE; // Just left of the screen
        y = Math.random() * canvasHeight;
        break;
      default:
        // Fallback to original logic
        direction = Math.random() < 0.5 ? 1 : -1;
        x = ship.position.x + (ROID_SIZE * 4 + ship.r) * direction;
        y = ship.position.y + (ROID_SIZE * 4 + ship.r) * direction;
    }

    const asteroidPosition = new Vector(x, y);
    this.roids.push(new Roid(asteroidPosition, Math.ceil(ROID_SIZE / 2)));
  }
  destroyRoid(i: number): number {
    const roids = this.roids;
    const r = roids[i].r;
    let score = 0;

    // split the asteroid if applicable
    if (r == Math.ceil(ROID_SIZE / 2)) {
      // large asteroid
      roids.push(new Roid(roids[i].position, Math.ceil(ROID_SIZE / 4)));
      roids.push(new Roid(roids[i].position, Math.ceil(ROID_SIZE / 4)));
      score += ROID_POINTS_LRG;
    } else if (r == Math.ceil(ROID_SIZE / 4)) {
      // medium asteroid
      roids.push(new Roid(roids[i].position, Math.ceil(ROID_SIZE / 8)));
      roids.push(new Roid(roids[i].position, Math.ceil(ROID_SIZE / 8)));
      score += ROID_POINTS_MED;
      // small asteroid
    } else {
      score += ROID_POINTS_SML;
    }

    roids.splice(i, 1);
    return score;
  }
  getRoids(): Roid[] {
    return this.roids;
  }

  /**
   * Move all asteroids in an array using their x and y velocity
   */
  moveRoids(): void {
    if (DISABLE_ASTEROIDS) return;
    for (const roid of this.roids) {
      // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
      // let dt = 1/Math.sqrt(1-beta_squared)
      roid.position = roid.position.add(roid.velocity);
    }
  }
  spawnRoids(ship: Ship): void {
    if (DISABLE_ASTEROIDS) return;
    if (this.spawnTime == 0) {
      // Spawn more asteroids since we have full-screen space
      const spawnCount = Math.min(6, Math.floor(window.innerWidth / 200)); // Scale with screen width
      for (let i = 0; i < spawnCount; i++) {
        this.addRoid(ship);
        this.spawnTime = ROID_SPAWN_TIME * FPS;
      }
    }
    this.spawnTime--;
  }

  // Add method to adjust asteroid count for multiplayer
  adjustForMultiplayer(): void {
    try {
      const gameController = GameController.getInstance();
      const isMultiplayer = gameController.isMultiplayerEnabled();

      // Only adjust if the state has changed
      if (isMultiplayer !== this.multiplayerAdjusted) {
        this.multiplayerAdjusted = isMultiplayer;

        if (isMultiplayer) {
          const playerCount = gameController.getPlayerCount();
          const currentAsteroidCount = this.roids.length;

          // Scale asteroid reduction based on player count
          // More players = fewer asteroids per player
          let reductionFactor = 0.4; // Base 40% reduction

          if (playerCount >= 5) {
            reductionFactor = 0.3; // 30% of normal for 5+ players
          } else if (playerCount >= 3) {
            reductionFactor = 0.35; // 35% of normal for 3-4 players
          }

          const targetCount = Math.max(
            2,
            Math.floor(currentAsteroidCount * reductionFactor),
          );

          // Remove excess asteroids if we have too many
          while (this.roids.length > targetCount) {
            this.roids.pop();
          }

          console.log(
            `Multiplayer mode: Reduced asteroids from ${currentAsteroidCount} to ${this.roids.length}`,
          );
        } else {
          // Reset to normal asteroid count
          const currentCount = this.roids.length;
          const normalCount = this.roidNum;

          // Add more asteroids if we have too few
          while (this.roids.length < normalCount) {
            this.addRoid(new Ship()); // Create a temporary ship for positioning
          }

          console.log(
            `Single player mode: Restored asteroids from ${currentCount} to ${this.roids.length}`,
          );
        }
      }
    } catch (error) {
      // If there's an error, just keep the current asteroid count
      console.warn('Could not adjust asteroids for multiplayer:', error);
    }
  }
}

export { RoidBelt, Roid };
