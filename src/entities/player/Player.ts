import { FPS, SHIP_INV_BLINK_DUR, SHIP_INV_DUR, START_LIVES } from '../../constants';
import { Vector } from '../../physics/Vector.ts';
import { generateRandomPlayerColor } from '../../utils/colorUtils.ts';
import { Ship } from '../ship/Ship.ts';
import type { Player as PlayerInterface } from './types.ts';

export class Player implements PlayerInterface {
  id: string;
  name: string;
  ship: Ship;
  score: number = 0;
  lastUpdate: number = Date.now();
  isBot?: boolean;
  lives: number = START_LIVES;
  respawnTimer?: number; // Timer for respawning after death (in frames)
  respawnPosition?: Vector; // Position where player will respawn
  spawnProtectedUntil: number; // Timestamp (ms) until which the player is invincible
  color: string; // Player's unique color for lasers and other visual elements

  constructor(params: { id: string; name: string; isBot?: boolean }) {
    this.id = params.id;
    this.name = params.name;
    this.ship = new Ship();
    this.lives = START_LIVES;
    this.isBot = params.isBot ?? false;
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

  private handleLifeLost(): void {
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
      this.ship.position = new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance);
    }

    this.ship.velocity = new Vector(0, 0);
    this.ship.a = Math.random() * Math.PI * 2; // Random rotation

    // Reset respawn timer and position
    this.respawnTimer = undefined;
    this.respawnPosition = undefined;

    // Set spawn protection
    this.spawnProtectedUntil = Date.now() + SHIP_INV_DUR * 1000;
  }
}
