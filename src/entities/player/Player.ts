import { v4 as uuidv4 } from 'uuid';
import { SHIP_INV_BLINK_DUR, SHIP_INV_DUR } from '../../constants/entities/ship';
import { START_LIVES } from '../../constants/game';
import { FPS } from '../../constants/physics';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import { Ship } from '../ship/Ship';
import type { Player as PlayerInterface, Position } from './types';

export class Player implements PlayerInterface {
  id: string;
  name: string;
  ship: Ship;
  score: number = 0;
  lastUpdate: number = Date.now();
  lives: number = START_LIVES;
  respawnTimer?: number; // Timer for respawning after death (in frames)
  respawnPosition?: Position; // Position where player will respawn
  spawnProtectedUntil: number; // Timestamp (ms) until which the player is invincible
  color: string; // Player's unique color for lasers and other visual elements

  constructor(params: { id: string; name: string }) {
    this.id = params.id;
    this.name = params.name;
    this.ship = new Ship();
    this.lives = START_LIVES;
    this.spawnProtectedUntil = Date.now() + 3000; // 3 seconds spawn protection

    // Assign a random color for this player
    this.color = generateRandomPlayerColor();
  }

  update(): void {
    this.ship.move();
    this.ship.moveLasers();
  }

  // Direct method called by Ship when it explodes
  onShipExploded(): void {
    // Decrement lives when ship explodes
    this.lives--;

    if (this.lives > 0) {
      // Player still has lives, handle respawn
      this.handleLifeLost();
    }
    // If lives <= 0, player is game over (no respawn)
  }

  handleLifeLost(): void {
    // After a life is lost, respawn the player
    this.respawn();
  }

  // Getter to check if player is dead (when no lives remaining)
  get isDead(): boolean {
    return this.lives <= 0;
  }

  respawn(): void {
    // Reset ship explosion state
    this.ship.exploding = false;
    this.ship.explodeTime = 0;

    // Give ship temporary invincibility (blinking effect)
    this.ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR); // 3 seconds invincibility
    this.ship.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS); // 0.1 seconds at 60 FPS
    this.ship.blinkOn = true;

    // Reset ship health to full
    this.ship.health = this.ship.maxHealth;
    this.ship.lastDamageTime = 0;
    this.ship.healthRegenTimer = 0;

    // Use respawn position if available, otherwise use random position
    if (this.respawnPosition) {
      this.ship.position = this.respawnPosition;
    } else {
      // Reset ship position to a safe location (random position around origin)
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 300; // Between 200-500 units from origin
      this.ship.position = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    }

    this.ship.velocity = { x: 0, y: 0 };
    this.ship.angle = Math.random() * Math.PI * 2; // Random rotation

    // Reset respawn timer and position
    this.respawnTimer = undefined;
    this.respawnPosition = undefined;

    // Set spawn protection
    this.spawnProtectedUntil = Date.now() + SHIP_INV_DUR * 1000;
  }

  static createPlayer(params: {
    id?: string;
    name?: string;
    position?: { x: number; y: number };
  }): Player {
    const id = params.id || uuidv4();
    const name = params.name || 'Player';

    const player = new Player({ id, name });

    if (params.position) {
      player.ship.position = params.position;
    }

    // Assign random color for players
    player.color = generateRandomPlayerColor();

    return player;
  }
}
