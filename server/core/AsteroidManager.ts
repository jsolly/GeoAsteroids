import type { AsteroidData } from '../../shared-types';
import { RNGService } from './RNGService';

export class AsteroidManager {
  private asteroids = new Map<string, AsteroidData>();
  private rng: RNGService;

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  public addAsteroid(asteroid: AsteroidData): void {
    this.asteroids.set(asteroid.id, asteroid);
  }

  public removeAsteroid(asteroidId: string): AsteroidData | undefined {
    const asteroid = this.asteroids.get(asteroidId);
    if (asteroid) {
      this.asteroids.delete(asteroidId);
    }
    return asteroid;
  }

  public updateAsteroid(asteroidId: string, updates: Partial<AsteroidData>): AsteroidData | undefined {
    const asteroid = this.asteroids.get(asteroidId);
    if (asteroid) {
      Object.assign(asteroid, updates);
    }
    return asteroid;
  }

  public getAsteroid(asteroidId: string): AsteroidData | undefined {
    return this.asteroids.get(asteroidId);
  }

  public getAllAsteroids(): AsteroidData[] {
    return Array.from(this.asteroids.values());
  }

  public getAsteroidCount(): number {
    return this.asteroids.size;
  }

  public clearAsteroids(): void {
    this.asteroids.clear();
  }

  public createAsteroids(count: number, bounds = { width: 2000, height: 2000 }): AsteroidData[] {
    // Clear existing asteroids
    this.asteroids.clear();

    // Reset RNG for deterministic asteroid generation
    this.rng.reset();

    const newAsteroids: AsteroidData[] = [];

    // Create new asteroids with deterministic IDs
    for (let i = 0; i < count; i++) {
      const asteroidId = `server-asteroid-${i}`;
      const position = this.rng.randomPosition(bounds);
      const velocity = this.rng.randomVelocity(4);

      const healthValue = Math.floor(this.rng.random() * 50) + 20; // Health between 20 and 70

      const asteroid: AsteroidData = {
        id: asteroidId,
        position,
        velocity,
        size: this.rng.random() * 40 + 20, // Size between 20 and 60
        jaggedness: this.rng.random() * 0.5 + 0.5, // Jaggedness between 0.5 and 1.0
        rotation: this.rng.random() * Math.PI * 2,
        angularVelocity: (this.rng.random() - 0.5) * 2, // Angular velocity between -1 and 1
        health: healthValue,
        maxHealth: healthValue,
      };

      this.asteroids.set(asteroidId, asteroid);
      newAsteroids.push(asteroid);
    }

    return newAsteroids;
  }

  public damageAsteroid(asteroidId: string, damage: number): AsteroidData | null {
    const asteroid = this.asteroids.get(asteroidId);
    if (!asteroid) {
      return null;
    }

    asteroid.health = Math.max(0, asteroid.health - damage);
    return asteroid;
  }
}
