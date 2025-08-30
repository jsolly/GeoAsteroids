import type { AsteroidData } from '../../../shared-types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Roid, RoidBelt } from '../../entities/roid/Roid';
import type { ClientMessage } from '../types';
import { ConnectionManager } from './ConnectionManager';

export class AsteroidSyncManager {
  private static instance: AsteroidSyncManager;
  private connectionManager: ConnectionManager;
  private localAsteroids = new Map<string, Roid>();

  private constructor() {
    this.connectionManager = ConnectionManager.getInstance();
    this.setupMessageHandlers();
  }

  static getInstance(): AsteroidSyncManager {
    if (!AsteroidSyncManager.instance) {
      AsteroidSyncManager.instance = new AsteroidSyncManager();
    }
    return AsteroidSyncManager.instance;
  }

  /**
   * Initialize asteroid synchronization
   */
  initialize(): void {
    // No longer need authority logic - server is now authoritative
  }

  /**
   * Set the asteroid belt for synchronization
   */
  setAsteroidBelt(roidBelt: RoidBelt): void {
    // Convert roid belt to our internal format
    this.localAsteroids.clear();
    for (const roid of roidBelt.roids) {
      this.localAsteroids.set(roid.id, roid);
    }

    // If connected to server, request server-managed asteroids
    if (this.connectionManager.isConnected()) {
      const initMessage: ClientMessage = {
        type: 'initAsteroids',
        id: 'client-request', // Will be overridden by connection manager
        data: {
          asteroidCount: roidBelt.roids.length,
        },
        timestamp: Date.now(),
      };
      this.connectionManager.sendMessage(initMessage);
      console.debug('MULTIPLAYER', 'Requested server asteroids', { count: roidBelt.roids.length });
    }
  }

  /**
   * Synchronize asteroid state to server (deprecated - server is now authoritative)
   */
  syncAsteroidState(_asteroid: Roid): void {
    // In server-authoritative system, clients don't send asteroid updates
    // Server manages all asteroid state and broadcasts changes
    console.debug('MULTIPLAYER', 'syncAsteroidState called but ignored - server is authoritative');
  }

  /**
   * Handle asteroid destruction (server-authoritative)
   */
  handleAsteroidDestruction(asteroidId: string): void {
    // In server-authoritative system, asteroid destruction is handled by server
    // We just remove from local cache when server notifies us
    this.localAsteroids.delete(asteroidId);
    console.debug('MULTIPLAYER', 'Asteroid removed from local cache', { asteroidId });
  }

  /**
   * Get synchronized asteroids
   */
  getSynchronizedAsteroids(): Roid[] {
    return Array.from(this.localAsteroids.values());
  }

  private setupMessageHandlers(): void {
    this.connectionManager.registerMessageHandler('asteroidCreate', (message) => {
      const { asteroid } = message.payload as { asteroid: AsteroidData };
      console.debug('MULTIPLAYER', 'Received server asteroid creation', asteroid.id);

      // Create proper Roid object and store in local cache
      const roid = entityFactory.createRoid({
        position: asteroid.position,
        size: asteroid.size,
      });

      // Override properties with server data
      roid.id = asteroid.id;
      roid.velocity = asteroid.velocity;
      roid.angle = asteroid.rotation;
      roid.angularVelocity = asteroid.angularVelocity;
      roid.health = asteroid.health;
      roid.maxHealth = asteroid.maxHealth;

      this.localAsteroids.set(asteroid.id, roid);

      // Dispatch event so game controller can update the asteroid belt
      window.dispatchEvent(
        new CustomEvent('serverAsteroidCreated', {
          detail: { asteroid },
        })
      );
    });

    this.connectionManager.registerMessageHandler('asteroidUpdate', (message) => {
      const { asteroidId, updates } = message.payload as {
        asteroidId: string;
        updates: Partial<AsteroidData>;
      };
      console.debug('MULTIPLAYER', 'Received server asteroid update', asteroidId);

      // Update local cache
      const existingAsteroid = this.localAsteroids.get(asteroidId);
      if (existingAsteroid) {
        Object.assign(existingAsteroid, updates);
      }

      // Dispatch event so game controller can update the asteroid belt
      window.dispatchEvent(
        new CustomEvent('serverAsteroidUpdated', {
          detail: { asteroidId, updates },
        })
      );
    });

    this.connectionManager.registerMessageHandler('asteroidDestroy', (message) => {
      const { asteroidId } = message.payload as { asteroidId: string };
      console.debug('MULTIPLAYER', 'Received server asteroid destruction', asteroidId);

      // Remove from local cache
      this.localAsteroids.delete(asteroidId);

      // Dispatch event so game controller can update the asteroid belt
      window.dispatchEvent(
        new CustomEvent('serverAsteroidDestroyed', {
          detail: { asteroidId },
        })
      );
    });
  }
}
