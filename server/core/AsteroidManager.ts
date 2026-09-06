import type { AsteroidData, Position } from '../../shared-types';
import { RNGService } from './RNGService';
import { ARENA, DEBUG } from '../../src/constants';
import { logger } from '../../setup/serverLogger';

export class AsteroidManager {
  private asteroids = new Map<string, AsteroidData>();
  private rng: RNGService;
  
  // Asteroid splitting constants - can be overridden by DEBUG settings
  private readonly MIN_ASTEROID_SIZE = 10;
  private readonly SPLIT_SIZE_RATIO = 0.6; // New asteroids are 60% of original size
  private readonly MAX_ASTEROID_COUNT = 200; // Prevent too many asteroids

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  // Getter methods for asteroid configuration
  private get minAsteroidSize(): number {
    return this.MIN_ASTEROID_SIZE;
  }

  private get splitSizeRatio(): number {
    return this.SPLIT_SIZE_RATIO;
  }

  private get maxAsteroidCount(): number {
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

  public createAsteroids(count: number, bounds = { radius: ARENA.BOUNDARY_RADIUS }, botPositions: Position[] = [], playerPositions: Position[] = []): AsteroidData[] {
    // If we already have asteroids and no player positions are provided, return them instead of recreating
    // But if player positions are provided, we should recreate to place roids on players
    // Also recreate if we're in test mode (PLACE_ON_LOCAL_PLAYER is true)
    const isTestMode = DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER;
    logger.debug('AsteroidManager: isTestMode =', isTestMode, 'playerPositions.length =', playerPositions.length, 'existing asteroids =', this.asteroids.size);
    if (this.asteroids.size > 0 && playerPositions.length === 0 && !isTestMode) {
      logger.debug('AsteroidManager: Returning existing asteroids instead of recreating');
      return Array.from(this.asteroids.values());
    }

    // Clear existing asteroids only if we're creating new ones
    this.asteroids.clear();

    // Reset RNG for deterministic asteroid generation
    this.rng.reset();

    // Use DEBUG asteroid count if available
    const asteroidCount = DEBUG.ROIDS.INITIAL_COUNT ?? count;
    const newAsteroids: AsteroidData[] = [];

    // Create new asteroids with deterministic IDs
    for (let i = 0; i < asteroidCount; i++) {
      const asteroidId = `server-asteroid-${i}`;
      
      // Determine position based on DEBUG settings
      let position: Position;
      if (DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER && playerPositions.length > 0) {
        // Place asteroids exactly on players when PLACE_ON_LOCAL_PLAYER is true (for testing)
        const playerPos = playerPositions[i % playerPositions.length];
        if (playerPos === undefined) {
          position = this.rng.randomPosition(bounds);
        } else {
          // Place asteroids exactly on the player for collision testing
          position = {
            x: playerPos.x,
            y: playerPos.y,
          };
        }
        console.log(`🪨 SERVER: Placing asteroid ${i} exactly on player at position:`, position);
      } else if (DEBUG.ROIDS.PLACE_ON_BOT && botPositions.length > 0) {
        // Place all asteroids on bots when PLACE_ON_BOT is true
        const botPos = botPositions[i % botPositions.length];
        position = botPos ?? this.rng.randomPosition(bounds);
        console.log(`🪨 SERVER: Placing asteroid ${i} on bot at position:`, position);
      } else {
        position = this.rng.randomPosition(bounds);
        console.log(`🪨 SERVER: Placing asteroid ${i} randomly at position:`, position);
      }
      
      const velocity = this.rng.randomVelocity(4);

      const healthValue = Math.floor(this.rng.random() * 50) + 20; // Health between 20 and 70

      const jaggedness = this.rng.random() * 0.5 + 0.5; // Jaggedness between 0.5 and 1.0
      const vertices = Math.floor(this.rng.random() * 8 + 6); // 6-13 vertices
      const offsets: number[] = [];
      
      // Generate shape offsets based on jaggedness
      for (let i = 0; i < vertices; i++) {
        offsets.push(this.rng.random() * jaggedness * 2 + 1 - jaggedness);
      }

      // Determine size based on DEBUG settings
      let size: number;
      // Check if we're in test mode (when PLACE_ON_LOCAL_PLAYER is true, assume test mode)
      const isTestMode = DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER;
      
      if (DEBUG.ROIDS.ALL_LARGE && !isTestMode) {
        size = 50; // Large size
      } else if (isTestMode) {
        // In test mode, create medium-sized asteroids that can split (size 20-30)
        size = this.rng.random() * 10 + 20; // Random between 20 and 30 (medium roids that can split)
      } else {
        // Create small roids (size < 25) when ALL_LARGE is false
        size = this.rng.random() * 10 + 10; // Random between 10 and 20 (small roids)
      }

      const asteroid: AsteroidData = {
        id: asteroidId,
        position,
        velocity,
        size,
        jaggedness,
        rotation: this.rng.random() * Math.PI * 2,
        angularVelocity: (this.rng.random() - 0.5) * 0.01, // Angular velocity between -0.005 and 0.005 (matches client)
        health: healthValue,
        maxHealth: healthValue,
        vertices,
        offsets,
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
    
    const destroyed = this.asteroids.get(asteroidId);
    if (!destroyed) {
      return { destroyed: undefined, newAsteroids: [] };
    }

    // Remove the destroyed asteroid
    this.asteroids.delete(asteroidId);

    const newAsteroids: AsteroidData[] = [];

    // Check if asteroid is large enough to split and we're under the limit
    // In test mode, split all asteroids (size >= 5)
    const isTestMode = DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER;
    const minSplitSize = isTestMode ? 5 : 25;
    if (destroyed.size >= minSplitSize && this.asteroids.size + 2 <= this.maxAsteroidCount) {
      
      // Create two smaller asteroids
      for (let i = 0; i < 2; i++) {
        const newSize = Math.max(this.minAsteroidSize, destroyed.size * this.splitSizeRatio);
        
        // Add small offset to prevent overlapping - asteroids should be slightly separated
        const offsetDistance = newSize * 0.3; // 30% of new asteroid size
        const angle = (i === 0) ? 0 : Math.PI; // Opposite directions
        const offsetX = Math.cos(angle) * offsetDistance;
        const offsetY = Math.sin(angle) * offsetDistance;
        
        // Generate shape data for new asteroid
        const newJaggedness = Math.max(0.3, destroyed.jaggedness * 0.8); // Slightly less jagged
        const newVertices = Math.floor(this.rng.random() * 8 + 6); // 6-13 vertices
        const newOffsets: number[] = [];
        
        // Generate shape offsets based on jaggedness
        for (let j = 0; j < newVertices; j++) {
          newOffsets.push(this.rng.random() * newJaggedness * 2 + 1 - newJaggedness);
        }

        // Create new asteroids with slight position offset and divergent velocities
        const newAsteroid: AsteroidData = {
          id: `server-asteroid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          position: {
            x: destroyed.position.x + offsetX,
            y: destroyed.position.y + offsetY
          },
          velocity: {
            x: destroyed.velocity.x + (this.rng.random() - 0.5) * 3 + offsetX * 0.1,
            y: destroyed.velocity.y + (this.rng.random() - 0.5) * 3 + offsetY * 0.1
          },
          size: newSize,
          jaggedness: newJaggedness,
          rotation: this.rng.random() * Math.PI * 2,
          angularVelocity: (this.rng.random() - 0.5) * 0.01, // Angular velocity between -0.005 and 0.005 (matches client)
          health: Math.floor(newSize * 0.8), // Health proportional to size
          maxHealth: Math.floor(newSize * 0.8),
          vertices: newVertices,
          offsets: newOffsets
        };

        newAsteroids.push(newAsteroid);
        this.asteroids.set(newAsteroid.id, newAsteroid);
      }
    }

    return { destroyed, newAsteroids };
  }
}
