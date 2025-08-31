import { GAME, SHIP } from '../../constants';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import { getRandomPositionWithinBoundary } from '../../utils/positionUtils';
import { Ship } from '../ship/Ship';

export class Player {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  ship: Ship;
  score: number = 0;
  lastUpdate: number = Date.now();
  lives: number = GAME.START_LIVES;
  respawnTimer?: number; // Timer for respawning after death (in frames)
  spawnProtectedUntil: number; // Timestamp (ms) until which the player is invincible
  color: string; // Player's unique color for lasers and other visual elements

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

    this.lives = GAME.START_LIVES;
    this.spawnProtectedUntil = Date.now() + 3000; // 3 seconds spawn protection

    // Set up event listeners for ship events
    this.setupShipEventListeners();
  }

  private setupShipEventListeners(): void {
    // Listen for ship explosion events
    window.addEventListener('shipExploded', (event: Event) => {
      const customEvent = event as CustomEvent<{
        shipId?: string;
        position?: { x: number; y: number };
        cause?: string;
      }>;
      // Check if this event is from our ship
      if (customEvent.detail?.shipId === this.ship.id) {
        this.onShipExploded(customEvent.detail);
      }
    });
  }

  update(): void {
    this.ship.move();
    this.ship.moveLasers();
  }

  // Direct method called by Ship when it explodes
  onShipExploded(detail?: { cause?: string }): void {
    // Decrement lives when ship explodes, but don't go below 0
    if (this.lives > 0) {
      this.lives--;
    }

    if (this.lives > 0) {
      // Player still has lives; set respawn timer based on explosion cause
      // Boundary collisions should respawn immediately after the explosion animation
      if (detail?.cause === 'boundary') {
        this.respawnTimer = SHIP.EXPLODE_DURATION_FRAMES;
      } else {
        // For other collisions, wait for explosion to finish, then respawn immediately
        // This provides a smooth experience: explosion animation -> immediate respawn
        this.respawnTimer = SHIP.EXPLODE_DURATION_FRAMES;
      }
    } else {
      // No lives remaining - game over
      // Dispatch game over event for the game controller to handle
      window.dispatchEvent(
        new CustomEvent('playerGameOver', {
          detail: { playerId: this.id },
        })
      );
    }
  }

  // Getter to check if player is dead (when no lives remaining)
  get isDead(): boolean {
    return this.lives <= 0;
  }

  respawn(): void {
    // Reset ship explosion state
    this.ship.exploding = false;
    this.ship.explodeTime = 0;

    // Always respawn at a random safe position within the boundary
    // This applies to ALL collision types: asteroid, laser, ship-to-ship, boundary, etc.
    const newPosition = getRandomPositionWithinBoundary();
    this.ship.position = newPosition;

    // Reset ship velocity to prevent momentum from previous life
    this.ship.velocity = { x: 0, y: 0 };

    // Reset ship angle to face upward (default orientation)
    this.ship.angle = (90 / 180) * Math.PI;

    // Give ship temporary invincibility (blinking effect)
    this.ship.blinkCount = Math.ceil(
      SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
    ); // 3 seconds invincibility
    this.ship.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES; // 0.1 seconds at 60 FPS
    this.ship.blinkOn = true;

    // Reset ship health to full
    this.ship.health = this.ship.maxHealth;
    this.ship.lastDamageTime = 0;
    this.ship.healthRegenTimer = 0;

    // Reset respawn timer
    this.respawnTimer = undefined;

    // Set spawn protection
    this.spawnProtectedUntil = Date.now() + (SHIP.INVINCIBILITY_DURATION_FRAMES / GAME.FPS) * 1000;
  }

  static createPlayer(params: {
    id: string;
    name: string;
    type: 'local' | 'remote' | 'bot';
    position: { x: number; y: number };
  }): Player {
    const player = new Player({ id: params.id, name: params.name, type: params.type });
    player.ship.position = params.position;
    return player;
  }
}
