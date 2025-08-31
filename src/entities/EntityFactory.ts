import { v4 as uuidv4 } from 'uuid';
import type { Position } from '../../shared-types';
import { CANVAS, DEBUG } from '../constants';
import { generateRandomPlayerColor } from '../utils/colorUtils';
import {
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../utils/positionUtils';
import { spawnRoidFromEdge } from '../utils/roidSpawn';
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
  shotCooldown?: number;
}

export interface BotConfig {
  count: number;
  localPlayerPosition?: Position;
  debugPlaceNearLocal?: boolean;
}

export interface RoidConfig {
  position?: Position;
  size?: number;
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

  createLocalPlayer(name: string, position?: Position): Player {
    return this.createPlayer({
      name,
      type: 'local',
      position,
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
    return new Roid(position, size);
  }

  createRoidBelt(): RoidBelt {
    return new RoidBelt();
  }

  createEmptyRoidBelt(): RoidBelt {
    return new RoidBelt(false);
  }

  // Private helper methods
  private instantiatePlayer(config: PlayerConfig): Player {
    const id = config.id || uuidv4();
    return new Player({
      id,
      name: config.name,
      type: config.type,
    });
  }

  private applyPlayerConfiguration(player: Player, config: PlayerConfig): void {
    // Set position
    const position = config.position || getRandomPositionWithinBoundary();
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
      player.color = '#888888'; // Default bot color
      player.ship.color = player.color;
    }

    if (config.shotCooldown === undefined) {
      player.ship.shotCooldown = 500 + Math.random() * 500; // 0.5-1.0 seconds
    }
  }

  private applyRemoteConfiguration(player: Player, config: PlayerConfig): void {
    // Remote players get random colors if not specified
    if (!config.color) {
      player.color = generateRandomPlayerColor();
      player.ship.color = player.color;
    }
  }

  private generateBotPositions(config: BotConfig): Position[] {
    const positions: Position[] = [];

    for (let i = 0; i < config.count; i++) {
      if (config.debugPlaceNearLocal && config.localPlayerPosition) {
        // Place bots near the local player in debug mode
        positions.push(getRandomPositionNearPoint(config.localPlayerPosition, 200));
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
    return spawnRoidFromEdge();
  }
}

// Export singleton instance for backward compatibility
export const entityFactory = EntityFactory.getInstance();
