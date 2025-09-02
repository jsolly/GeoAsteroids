import type { Position } from '../../../shared-types';
import { GAME } from '../../constants';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import { Ship } from '../ship/Ship';

export class Player {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  ship: Ship;
  score: number = 0;
  lastUpdate: number = Date.now();
  lives: number = GAME.START_LIVES;
  color: string; // Player's unique color for lasers and other visual elements
  deathCause?: string; // What killed the player (asteroid, boundary, player name, etc.)

  constructor(params: {
    id: string;
    name: string;
    type: 'local' | 'remote' | 'bot';
  }) {
    this.id = params.id;
    this.name = params.name;
    this.type = params.type;

    // Assign a random color for this player
    this.color = generateRandomPlayerColor();

    // Create ship with player's color
    this.ship = new Ship({
      color: this.color,
      isBot: this.type === 'bot',
    });
  }

  // Update player state from server data
  updateFromServer(data: {
    position?: Position;
    lives?: number;
    score?: number;
    exploding?: boolean;
    deathCause?: string;
  }): void {
    if (data.position) {
      this.ship.position = data.position;
    }
    if (data.lives !== undefined) {
      this.lives = data.lives;
    }
    if (data.score !== undefined) {
      this.score = data.score;
    }
    if (data.exploding !== undefined) {
      this.ship.exploding = data.exploding;
    }
    if (data.deathCause) {
      this.deathCause = data.deathCause;
    }
    this.lastUpdate = Date.now();
  }

  // Get current state for network transmission
  getStateForNetwork(): {
    position: Position;
    velocity: Position;
    r: number;
    angle: number;
    lives: number;
    score: number;
    exploding: boolean;
    health?: number;
    maxHealth?: number;
  } {
    return {
      position: this.ship.position,
      velocity: this.ship.velocity,
      r: this.ship.r,
      angle: this.ship.angle,
      lives: this.lives,
      score: this.score,
      exploding: this.ship.exploding,
      health: this.ship.health,
      maxHealth: this.ship.maxHealth,
    };
  }
}
