import type { AsteroidData } from '../../../shared-types';
import { entityFactory } from '../../entities/EntityFactory';
import type { Roid, RoidBelt } from '../../entities/roid/Roid';
import { logger } from '../../utils/Logger';
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
        id: this.connectionManager.getClientId(),
        data: {
          asteroidCount: roidBelt.roids.length,
        },
        timestamp: Date.now(),
      };
      this.connectionManager.sendMessage(initMessage);
      logger.debug('MULTIPLAYER', 'Requested server asteroids', { count: roidBelt.roids.length });
    }
  }

  /**
   * Synchronize asteroid state to server (deprecated - server is now authoritative)
   */
  syncAsteroidState(_asteroid: Roid): void {
    // In server-authoritative system, clients don't send asteroid updates
    // Server manages all asteroid state and broadcasts changes
    logger.debug('MULTIPLAYER', 'syncAsteroidState called but ignored - server is authoritative');
  }

  /**
   * Handle asteroid destruction (server-authoritative)
   */
  handleAsteroidDestruction(asteroidId: string): void {
    // In server-authoritative system, asteroid destruction is handled by server
    // We just remove from local cache when server notifies us
    this.localAsteroids.delete(asteroidId);
    logger.debug('MULTIPLAYER', 'Asteroid removed from local cache', { asteroidId });
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
      logger.debug('MULTIPLAYER', 'Received server asteroid creation', { asteroidId: asteroid.id });

      // Create proper Roid object and store in local cache
      const roid = entityFactory.createRoid({
        position: asteroid.position,
        size: asteroid.size,
      });

      // Validate and override properties with server data
      if (!asteroid.id || typeof asteroid.id !== 'string') {
        logger.warn('MULTIPLAYER', 'Invalid asteroid ID received from server', { asteroid });
        return;
      }

      // Validate position
      if (
        !asteroid.position ||
        typeof asteroid.position.x !== 'number' ||
        typeof asteroid.position.y !== 'number' ||
        !Number.isFinite(asteroid.position.x) ||
        !Number.isFinite(asteroid.position.y)
      ) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid position received from server', { asteroid });
        return;
      }

      // Validate velocity
      if (
        !asteroid.velocity ||
        typeof asteroid.velocity.x !== 'number' ||
        typeof asteroid.velocity.y !== 'number' ||
        !Number.isFinite(asteroid.velocity.x) ||
        !Number.isFinite(asteroid.velocity.y)
      ) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid velocity received from server', { asteroid });
        return;
      }

      // Validate numeric fields
      if (typeof asteroid.rotation !== 'number' || !Number.isFinite(asteroid.rotation)) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid rotation received from server', { asteroid });
        return;
      }

      if (
        typeof asteroid.angularVelocity !== 'number' ||
        !Number.isFinite(asteroid.angularVelocity)
      ) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid angularVelocity received from server', {
          asteroid,
        });
        return;
      }

      if (
        typeof asteroid.health !== 'number' ||
        !Number.isFinite(asteroid.health) ||
        asteroid.health < 0
      ) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid health received from server', { asteroid });
        return;
      }

      if (
        typeof asteroid.maxHealth !== 'number' ||
        !Number.isFinite(asteroid.maxHealth) ||
        asteroid.maxHealth < 0
      ) {
        logger.warn('MULTIPLAYER', 'Invalid asteroid maxHealth received from server', { asteroid });
        return;
      }

      // Ensure health <= maxHealth invariant
      if (asteroid.health > asteroid.maxHealth) {
        const originalHealth = asteroid.health;
        asteroid.health = Math.min(asteroid.health, asteroid.maxHealth);
        logger.warn(
          'MULTIPLAYER',
          `Asteroid health ${originalHealth} exceeds maxHealth ${asteroid.maxHealth}, clamped to ${asteroid.health}`,
          { asteroidId: asteroid.id }
        );
      }

      // All validations passed, apply server data
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

      // Validate asteroid ID
      if (!asteroidId || typeof asteroidId !== 'string') {
        logger.warn('MULTIPLAYER', 'Invalid asteroid ID in update message', { asteroidId });
        return;
      }

      // Validate updates object
      if (!updates || typeof updates !== 'object') {
        logger.warn('MULTIPLAYER', 'Invalid updates object in asteroid update', { updates });
        return;
      }

      // Validate update fields if they exist
      if (updates.position !== undefined) {
        if (
          !updates.position ||
          typeof updates.position.x !== 'number' ||
          typeof updates.position.y !== 'number' ||
          !Number.isFinite(updates.position.x) ||
          !Number.isFinite(updates.position.y)
        ) {
          logger.warn('MULTIPLAYER', 'Invalid position in asteroid update', {
            position: updates.position,
          });
          return;
        }
      }

      if (updates.velocity !== undefined) {
        if (
          !updates.velocity ||
          typeof updates.velocity.x !== 'number' ||
          typeof updates.velocity.y !== 'number' ||
          !Number.isFinite(updates.velocity.x) ||
          !Number.isFinite(updates.velocity.y)
        ) {
          logger.warn('MULTIPLAYER', 'Invalid velocity in asteroid update', {
            velocity: updates.velocity,
          });
          return;
        }
      }

      if (
        updates.rotation !== undefined &&
        (typeof updates.rotation !== 'number' || !Number.isFinite(updates.rotation))
      ) {
        logger.warn('MULTIPLAYER', 'Invalid rotation in asteroid update', {
          rotation: updates.rotation,
        });
        return;
      }

      if (
        updates.angularVelocity !== undefined &&
        (typeof updates.angularVelocity !== 'number' || !Number.isFinite(updates.angularVelocity))
      ) {
        logger.warn('MULTIPLAYER', 'Invalid angularVelocity in asteroid update', {
          angularVelocity: updates.angularVelocity,
        });
        return;
      }

      if (
        updates.health !== undefined &&
        (typeof updates.health !== 'number' ||
          !Number.isFinite(updates.health) ||
          updates.health < 0)
      ) {
        logger.warn('MULTIPLAYER', 'Invalid health in asteroid update', { health: updates.health });
        return;
      }

      if (
        updates.maxHealth !== undefined &&
        (typeof updates.maxHealth !== 'number' ||
          !Number.isFinite(updates.maxHealth) ||
          updates.maxHealth < 0)
      ) {
        logger.warn('MULTIPLAYER', 'Invalid maxHealth in asteroid update', {
          maxHealth: updates.maxHealth,
        });
        return;
      }

      // Ensure health <= maxHealth invariant for updates
      const existingAsteroid = this.localAsteroids.get(asteroidId);
      if (existingAsteroid && (updates.health !== undefined || updates.maxHealth !== undefined)) {
        const newHealth = updates.health !== undefined ? updates.health : existingAsteroid.health;
        const newMaxHealth =
          updates.maxHealth !== undefined ? updates.maxHealth : existingAsteroid.maxHealth;

        if (newHealth > newMaxHealth) {
          updates.health = Math.min(newHealth, newMaxHealth);
          logger.warn(
            'MULTIPLAYER',
            `Asteroid update: health ${newHealth} exceeds maxHealth ${newMaxHealth}, clamped to ${updates.health}`,
            { asteroidId }
          );
        }
      }

      logger.debug('MULTIPLAYER', 'Received server asteroid update', { asteroidId });

      // Update local cache
      if (existingAsteroid) {
        Object.assign(existingAsteroid, updates);
      } else {
        logger.warn('MULTIPLAYER', 'Attempted to update non-existent asteroid', { asteroidId });
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
      logger.debug('MULTIPLAYER', 'Received server asteroid destruction', { asteroidId });

      // Remove from local cache
      this.localAsteroids.delete(asteroidId);

      // Dispatch event so game controller can update the asteroid belt
      window.dispatchEvent(
        new CustomEvent('serverAsteroidDestroyed', {
          detail: { asteroidId },
        })
      );
    });

    this.connectionManager.registerMessageHandler('asteroidCreateBatch', (message) => {
      const { asteroids } = message.payload as { asteroids: AsteroidData[] };
      logger.debug('MULTIPLAYER', 'Received server asteroid batch creation', {
        count: asteroids.length,
      });

      // Process each asteroid in the batch
      for (const asteroid of asteroids) {
        logger.debug('MULTIPLAYER', 'Processing asteroid from batch', { asteroidId: asteroid.id });

        // Create proper Roid object and store in local cache
        const roid = entityFactory.createRoid({
          position: asteroid.position,
          size: asteroid.size,
        });

        // Validate and override properties with server data
        if (!asteroid.id || typeof asteroid.id !== 'string') {
          logger.warn('MULTIPLAYER', 'Invalid asteroid ID received from server in batch', {
            asteroid,
          });
          continue;
        }

        // Validate position
        if (
          !asteroid.position ||
          typeof asteroid.position.x !== 'number' ||
          typeof asteroid.position.y !== 'number' ||
          !Number.isFinite(asteroid.position.x) ||
          !Number.isFinite(asteroid.position.y)
        ) {
          logger.warn('MULTIPLAYER', 'Invalid asteroid position received from server in batch', {
            asteroid,
          });
          continue;
        }

        // Validate velocity
        if (
          !asteroid.velocity ||
          typeof asteroid.velocity.x !== 'number' ||
          typeof asteroid.velocity.y !== 'number' ||
          !Number.isFinite(asteroid.velocity.x) ||
          !Number.isFinite(asteroid.velocity.y)
        ) {
          logger.warn('MULTIPLAYER', 'Invalid asteroid velocity received from server in batch', {
            asteroid,
          });
          continue;
        }

        // Validate numeric fields
        if (typeof asteroid.rotation !== 'number' || !Number.isFinite(asteroid.rotation)) {
          logger.warn('MULTIPLAYER', 'Invalid asteroid rotation received from server in batch', {
            asteroid,
          });
          continue;
        }

        if (
          typeof asteroid.angularVelocity !== 'number' ||
          !Number.isFinite(asteroid.angularVelocity)
        ) {
          logger.warn(
            'MULTIPLAYER',
            'Invalid asteroid angularVelocity received from server in batch',
            { asteroid }
          );
          continue;
        }

        if (
          typeof asteroid.health !== 'number' ||
          !Number.isFinite(asteroid.health) ||
          asteroid.health < 0
        ) {
          logger.warn('MULTIPLAYER', 'Invalid asteroid health received from server in batch', {
            asteroid,
          });
          continue;
        }

        if (
          typeof asteroid.maxHealth !== 'number' ||
          !Number.isFinite(asteroid.maxHealth) ||
          asteroid.maxHealth < 0
        ) {
          logger.warn('MULTIPLAYER', 'Invalid asteroid maxHealth received from server in batch', {
            asteroid,
          });
          continue;
        }

        // Ensure health <= maxHealth invariant
        if (asteroid.health > asteroid.maxHealth) {
          const originalHealth = asteroid.health;
          asteroid.health = Math.min(asteroid.health, asteroid.maxHealth);
          logger.warn(
            'MULTIPLAYER',
            `Asteroid health ${originalHealth} exceeds maxHealth ${asteroid.maxHealth}, clamped to ${asteroid.health}`,
            { asteroidId: asteroid.id }
          );
        }

        // All validations passed, apply server data
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
      }
    });
  }
}
