import { Sound } from '../../audio/Sound';
import {
  DRAW_ASTEROIDS,
  FPS,
  getRoidNum,
  ROID_JAGG,
  ROID_POINTS_LRG,
  ROID_POINTS_MED,
  ROID_POINTS_SML,
  ROID_SIZE,
  ROID_SPAWN_TIME,
  ROID_SPEED,
  ROID_VERTICES,
} from '../../constants';
import { GameController } from '../../core/gameController';
import { Vector } from '../../physics/Vector';
import {
  calculateMultiplayerReductionFactor,
  calculateSpawnCount,
  calculateTargetAsteroidCount,
  spawnAsteroidFromEdge,
} from './asteroidUtils';

class Asteroid {
  a: number;
  readonly offsets: number[] = [];
  vertices: number;
  velocity: Vector;
  static fxHit = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Vector,
    public r: number
  ) {
    const currLevel = 0;
    const lvlMult = 1 + 0.1 * currLevel;
    this.a = Math.random() * Math.PI * 2; // in radians
    const speed = (Math.random() * ROID_SPEED * lvlMult) / FPS;
    this.velocity = new Vector(
      speed * (Math.random() < 0.5 ? 1 : -1),
      speed * (Math.random() < 0.5 ? 1 : -1)
    );

    this.vertices = Math.floor(Math.random() * (ROID_VERTICES + 1) + ROID_VERTICES / 2);

    for (let i = 0; i < this.vertices; i++) {
      this.offsets.push(Math.random() * ROID_JAGG * 2 + 1 - ROID_JAGG);
    }
  }
}

class AsteroidBelt {
  roidNum = getRoidNum();
  roids: Asteroid[] = [];
  spawnTime: number = Math.ceil(ROID_SPAWN_TIME * FPS);
  private multiplayerAdjusted = false;

  constructor() {
    // Don't check multiplayer mode during construction to avoid circular dependency
    // The asteroid count will be adjusted later when the game starts

    if (DRAW_ASTEROIDS) {
      for (let i = 0; i < this.roidNum; i++) {
        this.addRoid();
      }
    }
  }

  addRoid(): void {
    if (!DRAW_ASTEROIDS) {
      return;
    }

    const asteroidPosition = spawnAsteroidFromEdge();
    this.roids.push(new Asteroid(asteroidPosition, Math.ceil(ROID_SIZE / 2)));
  }

  destroyRoid(i: number): number {
    const roids = this.roids;
    const r = roids[i].r;
    let score = 0;

    // split the asteroid if applicable
    if (r === Math.ceil(ROID_SIZE / 2)) {
      // large asteroid
      roids.push(new Asteroid(roids[i].position, Math.ceil(ROID_SIZE / 4)));
      roids.push(new Asteroid(roids[i].position, Math.ceil(ROID_SIZE / 4)));
      score += ROID_POINTS_LRG;
    } else if (r === Math.ceil(ROID_SIZE / 4)) {
      // medium asteroid
      roids.push(new Asteroid(roids[i].position, Math.ceil(ROID_SIZE / 8)));
      roids.push(new Asteroid(roids[i].position, Math.ceil(ROID_SIZE / 8)));
      score += ROID_POINTS_MED;
      // small asteroid
    } else {
      score += ROID_POINTS_SML;
    }

    roids.splice(i, 1);
    return score;
  }

  getRoids(): Asteroid[] {
    return this.roids;
  }

  moveRoids(): void {
    if (!DRAW_ASTEROIDS) {
      return;
    }
    for (const roid of this.roids) {
      // let beta_squared = (ship.xv-roids[i].xv)**2 +(ship.yv-roids[i].yv)**2
      // let dt = 1/Math.sqrt(1-beta_squared)
      roid.position = roid.position.add(roid.velocity);
    }
  }

  spawnRoids(): void {
    if (!DRAW_ASTEROIDS) {
      return;
    }
    if (this.spawnTime === 0) {
      // Spawn more asteroids since we have full-screen space
      const spawnCount = calculateSpawnCount();
      for (let i = 0; i < spawnCount; i++) {
        this.addRoid();
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
          const reductionFactor = calculateMultiplayerReductionFactor(playerCount);
          const targetCount = calculateTargetAsteroidCount(currentAsteroidCount, reductionFactor);

          // Remove excess asteroids if we have too many
          while (this.roids.length > targetCount) {
            this.roids.pop();
          }
        } else {
          // Reset to normal asteroid count
          const normalCount = this.roidNum;

          // Add more asteroids if we have too few
          while (this.roids.length < normalCount) {
            this.addRoid();
          }
        }
      }
    } catch (error) {
      // If there's an error, just keep the current asteroid count
      console.warn('Could not adjust asteroids for multiplayer:', error);
    }
  }
}

export { AsteroidBelt, Asteroid };
