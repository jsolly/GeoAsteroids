import type { Position } from '../../../shared-types';
import { CANVAS, DEBUG, GAME, SHIP } from '../../constants';
import { generateRandomPlayerColor } from '../../utils/colorUtils';
import {
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../../utils/positionUtils';
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

    this.spawnProtectedUntil = Date.now() + (SHIP.INVINCIBILITY_DURATION_FRAMES / GAME.FPS) * 1000;
    if (process.env.NODE_ENV === 'test') {
      // Disable initial spawn protection in tests to allow collision scenarios
      this.spawnProtectedUntil = 0;
      // Also disable blink-based invincibility so collision tests can apply damage
      this.ship.blinkCount = 0;
      this.ship.spawnProtectionTimer = 0;
      this.ship.blinkOn = false;
    }

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
  onShipExploded(detail?: { cause?: string; killerName?: string }): void {
    // Store the death cause for display
    if (detail?.cause) {
      this.deathCause = this.formatDeathCause(detail.cause, detail.killerName);
    }

    // Decrement lives when ship explodes, but don't go below 0
    if (this.lives > 0) {
      this.lives--;
    }

    // Always dispatch death event with cause (for both life loss and game over)
    window.dispatchEvent(
      new CustomEvent('playerDied', {
        detail: {
          playerId: this.id,
          deathCause: this.deathCause || 'Unknown',
          isGameOver: this.lives <= 0,
        },
      })
    );

    if (this.lives > 0) {
      // Player still has lives; set respawn timer with delay to show death message
      // Add extra delay after explosion animation to show the death message with backdrop
      const messageDisplayFrames = 120; // 2 seconds at 60 FPS
      this.respawnTimer = SHIP.EXPLODE_DURATION_FRAMES + messageDisplayFrames;
    } else {
      // No lives remaining - game over
      // Delay the game over event until after explosion animation completes
      setTimeout(
        () => {
          window.dispatchEvent(
            new CustomEvent('playerGameOver', {
              detail: {
                playerId: this.id,
                deathCause: this.deathCause || 'Unknown',
              },
            })
          );
        },
        (SHIP.EXPLODE_DURATION_FRAMES / GAME.FPS) * 1000
      ); // Wait for explosion animation to complete
    }
  }

  // Helper method to format death cause for display
  private formatDeathCause(cause: string, killerName?: string): string {
    switch (cause) {
      case 'asteroid':
        return 'colliding with an asteroid. Space rocks are not your friends!';
      case 'boundary':
        return 'colliding with the boundary. What a goof! Did you forget how to fly?';
      case 'player':
        return killerName
          ? `colliding with ${killerName}. Maybe try dodging next time?`
          : 'colliding with another player. Oops!';
      case 'laser':
        return killerName
          ? `${killerName}'s laser. Pew pew, you got zapped!`
          : 'a laser. Someone has good aim!';
      default:
        return cause;
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

    // Determine respawn position based on debug flag
    let newPosition: Position;
    if (DEBUG.PLACE_PLAYERS_NEAR_CENTER) {
      // Place near center when debug flag is enabled
      const centerPosition = { x: CANVAS.DEFAULT_CENTER_X, y: CANVAS.DEFAULT_CENTER_Y };
      newPosition = getRandomPositionNearPoint(centerPosition, 150); // Within 150 pixels of center
    } else {
      // Default behavior: random position within boundary
      newPosition = getRandomPositionWithinBoundary();
    }

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
