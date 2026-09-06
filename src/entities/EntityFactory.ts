import { v4 as uuidv4 } from 'uuid';
import type { Position, ShipKitId, SoftFactionId, Velocity } from '../../shared-types';
import { CANVAS, DEBUG, PALETTE, SPAWN } from '../constants';
import { MockPlayerInput } from '../input/MockPlayerInput';
import { getFactionColor } from '../utils/colorUtils';
import {
  getRandomPositionNearBoundary,
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../utils/positionUtils';
import { Laser } from './laser/Laser';
import { Player } from './player/Player';
import { Roid, RoidBelt } from './roid/Roid';

// Constants for entity creation limits
const MAX_BOTS = 20; // Maximum number of bots allowed

// Entity creation configuration interfaces
export interface PlayerConfig {
  id?: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  position?: Position;
  color?: string;
  faction?: FactionId;
  shotCooldown?: number;
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
}

export interface BotConfig {
  count: number;
  localPlayerPosition?: Position;
  debugPlaceNearLocal?: boolean;
}

export interface RoidConfig {
  position?: Position;
  size?: number;
  id?: string;
}

/**
 * Unified EntityFactory for creating all game entities
 * Consolidates PlayerFactory, BotFactory, and Roid creation patterns
 */
export class EntityFactory {
  private static instance: EntityFactory;

  private constructor() {}

  static getInstance(): EntityFactory {
    if (!EntityFactory.instance) {
      EntityFactory.instance = new EntityFactory();
    }
    return EntityFactory.instance;
  }

  // Player creation methods
  createPlayer(config: PlayerConfig): Player {
    const player = this.instantiatePlayer(config);
    this.applyPlayerConfiguration(player, config);
    this.applyTypeSpecificConfiguration(player, config);
    return player;
  }

  createLocalPlayer(name: string, position?: Position, kitId?: ShipKitId): Player {
    return this.createPlayer({
      name,
      type: 'local',
      position,
      kitId,
    });
  }

  createRemotePlayer(id: string, name: string, position: Position, color?: string): Player {
    return this.createPlayer({
      id,
      name,
      type: 'remote',
      position,
      color,
    });
  }

  createBotPlayer(name: string, position?: Position): Player {
    return this.createPlayer({
      name,
      type: 'bot',
      position,
    });
  }

  // Bot creation methods
  createBots(config: BotConfig): Map<string, Player> {
    // Validate the incoming config.count
    if (!Number.isFinite(config.count) || !Number.isInteger(config.count)) {
      throw new Error(`Bot count must be a finite integer, got: ${config.count}`);
    }

    if (config.count < 0) {
      throw new Error(`Bot count cannot be negative, got: ${config.count}`);
    }

    if (config.count > MAX_BOTS) {
      throw new Error(`Bot count cannot exceed maximum of ${MAX_BOTS}, got: ${config.count}`);
    }

    // Handle zero as a no-op
    if (config.count === 0) {
      return new Map<string, Player>();
    }

    const bots = new Map<string, Player>();
    const positions = this.generateBotPositions(config);

    // Validate that positions array length matches the count
    if (positions.length !== config.count) {
      throw new Error(
        `Position generation failed: expected ${config.count} positions, got ${positions.length}`
      );
    }

    for (let i = 0; i < config.count; i++) {
      const position = positions[i];
      const bot = this.createBotPlayer(this.generateBotName(), position);
      // Set last position for movement tracking
      bot.ship.lastPosition = { ...bot.ship.position };
      bots.set(bot.id, bot);
    }

    return bots;
  }

  // Roid creation methods
  createRoid(config: RoidConfig = {}): Roid {
    const position = config.position || this.generateRandomRoidPosition();
    const size = config.size || 15; // Default medium size
    return new Roid(position, size, config.id);
  }

  createRoidBelt(): RoidBelt {
    return new RoidBelt();
  }

  createEmptyRoidBelt(): RoidBelt {
    return new RoidBelt(false);
  }

  // Laser creation method
  createLaser(config: {
    position: Position;
    velocity: Velocity;
    distTraveled: number;
    explodeTime: number;
    hasExploded: boolean;
  }): Laser {
    return new Laser(
      config.position,
      config.velocity,
      config.distTraveled,
      config.explodeTime,
      config.hasExploded
    );
  }

  // Private helper methods
  private instantiatePlayer(config: PlayerConfig): Player {
    const id = config.id || uuidv4();
    return new Player({
      id,
      name: config.name,
      type: config.type,
      input: new MockPlayerInput(),
      kitId: config.kitId,
      factionId: config.factionId ?? config.faction,
    });
  }

  private applyPlayerConfiguration(player: Player, config: PlayerConfig): void {
    // Set position based on debug flags if none provided
    // Priority: PLACE_PLAYERS_NEAR_BOUNDARY > PLACE_PLAYERS_NEAR_CENTER > default
    let position: Position;
    if (config.position) {
      position = config.position;
    } else if (DEBUG.PLACE_PLAYERS_NEAR_BOUNDARY) {
      // Place near boundary when debug flag is enabled
      position = getRandomPositionNearBoundary();
    } else if (DEBUG.PLACE_PLAYERS_NEAR_CENTER) {
      // Place near center when debug flag is enabled
      const centerPosition = { x: CANVAS.DEFAULT_CENTER_X, y: CANVAS.DEFAULT_CENTER_Y };
      position = getRandomPositionNearPoint(centerPosition, 150);
    } else {
      // Default: spawn near the arena center (world origin) so players joining
      // the same server appear within view of each other. Spawning anywhere in
      // the full boundary radius (~3100px) scatters players thousands of px
      // apart, leaving them permanently off each other's screens even though
      // the leaderboard lists everyone. See SPAWN.NEAR_CENTER_RADIUS.
      position = getRandomPositionNearPoint({ x: 0, y: 0 }, SPAWN.NEAR_CENTER_RADIUS);
    }
    player.ship.position = position;

    // Apply customizations
    if (config.color) {
      player.color = config.color;
      player.ship.color = config.color;
    }

    if (config.shotCooldown !== undefined) {
      player.ship.shotCooldown = config.shotCooldown;
    }
  }

  private applyTypeSpecificConfiguration(player: Player, config: PlayerConfig): void {
    switch (config.type) {
      case 'bot':
        this.applyBotConfiguration(player, config);
        break;
      case 'remote':
        this.applyRemoteConfiguration(player, config);
        break;
      case 'local':
        // Local players use default configuration
        break;
    }
  }

  private applyBotConfiguration(player: Player, config: PlayerConfig): void {
    // Apply bot-specific defaults if not specified
    if (!config.color) {
      player.color = PALETTE.BOT;
      player.ship.color = player.color;
    }

    if (config.shotCooldown === undefined) {
      player.ship.shotCooldown = 500 + Math.random() * 500; // 0.5-1.0 seconds
    }
  }

  private applyRemoteConfiguration(player: Player, config: PlayerConfig): void {
    // Remote players use the color provided by the server
    if (config.color) {
      player.color = config.color;
      player.ship.color = config.color;
    } else {
      // Fallback to random color if no color provided (shouldn't happen with proper server sync)
      player.color = getFactionColor('remote');
      player.ship.color = player.color;
    }
  }

  private generateBotPositions(config: BotConfig): Position[] {
    const positions: Position[] = [];

    for (let i = 0; i < config.count; i++) {
      if (config.debugPlaceNearLocal && config.localPlayerPosition) {
        // Place bots near the local player in debug mode
        positions.push(getRandomPositionNearPoint(config.localPlayerPosition, 200));
      } else if (DEBUG.PLACE_PLAYERS_NEAR_BOUNDARY) {
        // Place bots near boundary when debug flag is enabled
        positions.push(getRandomPositionNearBoundary());
      } else if (DEBUG.PLACE_PLAYERS_NEAR_CENTER) {
        // Place bots near center when debug flag is enabled
        const centerPosition = { x: CANVAS.DEFAULT_CENTER_X, y: CANVAS.DEFAULT_CENTER_Y };
        positions.push(getRandomPositionNearPoint(centerPosition, 200));
      } else {
        // Place bots randomly within the boundary (default behavior)
        positions.push(getRandomPositionWithinBoundary());
      }
    }

    return positions;
  }

  private generateBotName(): string {
    const adjectives = [
      'Crimson',
      'Nebula',
      'Quantum',
      'Cosmic',
      'Lunar',
      'Solar',
      'Galactic',
      'Star',
      'Nova',
      'Meteor',
    ];
    const nouns = [
      'Falcon',
      'Viper',
      'Ranger',
      'Specter',
      'Comet',
      'Warden',
      'Drifter',
      'Marauder',
      'Pioneer',
      'Corsair',
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective} ${noun}`;
  }

  private generateRandomRoidPosition(): Position {
    // Generate random position within boundary since roidSpawn was removed
    return getRandomPositionWithinBoundary();
  }
}

// Export singleton instance for backward compatibility
export const entityFactory = EntityFactory.getInstance();
