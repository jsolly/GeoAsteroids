import type { AsteroidData } from '../../shared-types';
import { RNGService } from './RNGService';

export class AsteroidManager {
  private asteroids = new Map<string, AsteroidData>();
  private rng: RNGService;
  
  // Asteroid splitting constants - can be overridden by DEBUG settings
  private readonly MIN_ASTEROID_SIZE = 10;
  private readonly SPLIT_SIZE_RATIO = 0.6; // New asteroids are 60% of original size
  private readonly MAX_ASTEROID_COUNT = 20; // Prevent too many asteroids

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  // Getter methods to allow DEBUG overrides
  private get minAsteroidSize(): number {
    // Check if DEBUG constants are available (client-side)
    if (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG) {
      return (globalThis as any).DEBUG.MIN_ROID_SIZE ?? this.MIN_ASTEROID_SIZE;
    }
    return this.MIN_ASTEROID_SIZE;
  }

  private get splitSizeRatio(): number {
    if (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG) {
      return (globalThis as any).DEBUG.SPLIT_SIZE_RATIO ?? this.SPLIT_SIZE_RATIO;
    }
    return this.SPLIT_SIZE_RATIO;
  }

  private get maxAsteroidCount(): number {
    if (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG) {
      return (globalThis as any).DEBUG.MAX_ROID_COUNT ?? this.MAX_ASTEROID_COUNT;
    }
    return this.MAX_ASTEROID_COUNT;
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

  /**
   * Destroys an asteroid and potentially creates smaller ones
   * @param asteroidId - ID of the asteroid to destroy
   * @returns Object containing the destroyed asteroid and any new asteroids created
   */
  public destroyAsteroid(asteroidId: string): { destroyed: AsteroidData | undefined; newAsteroids: AsteroidData[] } {
    console.log('DEBUG: destroyAsteroid called for asteroidId:', asteroidId);
    
    const destroyed = this.asteroids.get(asteroidId);
    if (!destroyed) {
      console.log('DEBUG: Asteroid not found:', asteroidId);
      return { destroyed: undefined, newAsteroids: [] };
    }

    console.log('DEBUG: Destroying asteroid:', { id: destroyed.id, size: destroyed.size, currentCount: this.asteroids.size });

    // Remove the destroyed asteroid
    this.asteroids.delete(asteroidId);

    const newAsteroids: AsteroidData[] = [];

    // Check if asteroid is large enough to split and we're under the limit
    if (destroyed.size > this.minAsteroidSize * 2 && this.asteroids.size + 2 <= this.maxAsteroidCount) {
      console.log('DEBUG: Asteroid is large enough to split, creating new asteroids');
      
      // Create two smaller asteroids
      for (let i = 0; i < 2; i++) {
        const newSize = Math.max(this.minAsteroidSize, destroyed.size * this.splitSizeRatio);
        
        // Add some randomness to the new positions to avoid overlap
        const offsetX = (this.rng.random() - 0.5) * destroyed.size * 0.3;
        const offsetY = (this.rng.random() - 0.5) * destroyed.size * 0.3;
        
        const newAsteroid: AsteroidData = {
          id: `server-asteroid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          position: {
            x: destroyed.position.x + offsetX,
            y: destroyed.position.y + offsetY
          },
          velocity: {
            x: destroyed.velocity.x + (this.rng.random() - 0.5) * 2,
            y: destroyed.velocity.y + (this.rng.random() - 0.5) * 2
          },
          size: newSize,
          jaggedness: Math.max(0.3, destroyed.jaggedness * 0.8), // Slightly less jagged
          rotation: this.rng.random() * Math.PI * 2,
          angularVelocity: (this.rng.random() - 0.5) * 2,
          health: Math.floor(newSize * 0.8), // Health proportional to size
          maxHealth: Math.floor(newSize * 0.8)
        };

        console.log('DEBUG: Created new asteroid:', { id: newAsteroid.id, size: newAsteroid.size });
        newAsteroids.push(newAsteroid);
        this.asteroids.set(newAsteroid.id, newAsteroid);
      }
    } else {
      console.log('DEBUG: Asteroid not split - size:', destroyed.size, 'minSize:', this.minAsteroidSize * 2, 'currentCount:', this.asteroids.size, 'maxCount:', this.maxAsteroidCount);
    }

    console.log('DEBUG: destroyAsteroid result:', { destroyed: destroyed.id, newAsteroids: newAsteroids.length });
    return { destroyed, newAsteroids };
  }
}
