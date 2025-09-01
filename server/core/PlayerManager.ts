import { WebSocket } from 'ws';
import type { Position, Velocity } from '../../shared-types';
import { calculateHealthAfterHeal, calculateHealthRegenPerFrame, shouldStartHealthRegeneration, calculateHealthRegenDelayFrames } from '../../src/entities/ship/shipUtils';

export interface ConnectedPlayer {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  rotation: number;
  angularVelocity: number;
  lives: number;
  score: number;
  exploding: boolean;
  health?: number;
  maxHealth?: number;
  lastUpdate: number;
  ws: WebSocket;
  // Backward compatibility property
  a?: number;
  respawnTimer?: number; // Added for respawn logic
}

interface PlayerHealthRegenerationState {
  lastDamageTime: number;
  healthRegenTimer: number;
}

export class PlayerManager {
  private players = new Map<string, ConnectedPlayer>();
  private playerHealthRegenerationState = new Map<string, PlayerHealthRegenerationState>();



  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position): ConnectedPlayer {
    const player: ConnectedPlayer = {
      id,
      name,
      position: position || { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      lives: 3,
      score: 0,
      exploding: false,
      health: 100,
      maxHealth: 100,
      lastUpdate: Date.now(),
      ws,
    };

    this.players.set(id, player);
    return player;
  }

  public removePlayer(id: string): ConnectedPlayer | undefined {
    const player = this.players.get(id);
    if (player) {
      this.players.delete(id);
    }
    return player;
  }

  public updatePlayer(id: string, updates: Partial<ConnectedPlayer>): ConnectedPlayer | undefined {
    const player = this.players.get(id);
    if (player) {
      // Use Object.assign for efficient bulk assignment
      const updateData: Partial<ConnectedPlayer> = {};

      if (updates.position) updateData.position = updates.position;
      if (updates.velocity) updateData.velocity = updates.velocity;
      if (updates.rotation !== undefined) updateData.rotation = updates.rotation;
      if (updates.angularVelocity !== undefined) updateData.angularVelocity = updates.angularVelocity;
      if (updates.lives !== undefined) updateData.lives = updates.lives;
      if (updates.score !== undefined) updateData.score = updates.score;
      if (updates.exploding !== undefined) updateData.exploding = updates.exploding;
      if (updates.health !== undefined) updateData.health = updates.health;
      if (updates.maxHealth !== undefined) updateData.maxHealth = updates.maxHealth;
      if (updates.respawnTimer !== undefined) updateData.respawnTimer = updates.respawnTimer; // Added for respawn logic

      // Backward compatibility for old 'a' property (maps to angularVelocity; 'r' refers to ship radius)
      if (updates.a !== undefined) updateData.angularVelocity = updates.a;

      // Track damage for regeneration
      if (updates.health !== undefined && updates.health < (player.health ?? 100)) {
        this.handlePlayerDamage(id);
      }

      Object.assign(player, updateData);
      player.lastUpdate = Date.now();
    }
    return player;
  }

  private handlePlayerDamage(playerId: string): void {
    // Get or initialize health regeneration state for this player
    let regenState = this.playerHealthRegenerationState.get(playerId);
    if (!regenState) {
      regenState = {
        lastDamageTime: 0, // Start at 0 (no time elapsed since damage)
        healthRegenTimer: calculateHealthRegenDelayFrames()
      };
      this.playerHealthRegenerationState.set(playerId, regenState);
    } else {
      // Reset timers on new damage
      regenState.lastDamageTime = 0; // Reset to 0 (no time elapsed since damage)
      regenState.healthRegenTimer = calculateHealthRegenDelayFrames();
    }
  }

  public updatePlayerHealthRegeneration(): void {
    const players = this.getAllPlayers();

    for (const player of players) {
      if (player.exploding || (player.health ?? 100) <= 0) {
        continue; // Skip exploding or dead players
      }

      // Get or initialize health regeneration state for this player
      let regenState = this.playerHealthRegenerationState.get(player.id);
      if (!regenState) {
        // Initialize state for players that haven't been damaged yet
        regenState = {
          lastDamageTime: 0,
          healthRegenTimer: 0
        };
        this.playerHealthRegenerationState.set(player.id, regenState);
      }

      // Update damage cooldown timer (increment elapsed time)
      if (regenState.lastDamageTime >= 0) {
        regenState.lastDamageTime++;
      }

      // Check if health regeneration should start
      if (shouldStartHealthRegeneration(regenState.lastDamageTime, player.health || 100, player.maxHealth || 100)) {
        if (regenState.healthRegenTimer <= 0) {
          // Regenerate health
          const regenAmount = calculateHealthRegenPerFrame();
          const newHealth = calculateHealthAfterHeal(player.health || 100, regenAmount, player.maxHealth || 100);

          if (newHealth > (player.health || 100)) {
            // Update player health
            this.updatePlayer(player.id, { health: newHealth });
          }
        } else {
          // Decrement regeneration delay timer
          regenState.healthRegenTimer--;
        }
      }
    }
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this.players.get(id);
  }

  public getAllPlayers(): ConnectedPlayer[] {
    return Array.from(this.players.values());
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public cleanupStalePlayers(): string[] {
    const now = Date.now();
    const removedPlayers: string[] = [];

    for (const [id, player] of this.players.entries()) {
      if (now - player.lastUpdate > 30000) { // 30 seconds
        this.players.delete(id);
        removedPlayers.push(id);
      }
    }

    return removedPlayers;
  }

  public damagePlayer(playerId: string, damage: number): ConnectedPlayer | null {
    const player = this.players.get(playerId);
    if (!player || player.exploding) {
      return null;
    }

    // Ensure player has health initialized
    if (player.health === undefined) {
      player.health = 100;
    }

    const wasAlive = player.health > 0;
    player.health = Math.max(0, player.health - damage);

    // If player is destroyed, set exploding state
    if (player.health <= 0 && wasAlive) {
      player.exploding = true;
    }

    player.lastUpdate = Date.now();
    return player;
  }

  public awardPoints(playerId: string, points: number): ConnectedPlayer | null {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    player.score += points;
    player.lastUpdate = Date.now();
    return player;
  }

  public respawnPlayer(playerId: string): ConnectedPlayer | null {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    // Reset explosion state
    player.exploding = false;
    
    // Reset health to full
    player.health = player.maxHealth || 100;
    
    // Generate new random position
    const newPosition = this.generateRandomPosition();
    player.position = newPosition;
    
    // Reset velocity and rotation
    player.velocity = { x: 0, y: 0 };
    player.rotation = 0;
    player.angularVelocity = 0;
    
    // Clear respawn timer
    player.respawnTimer = undefined;
    
    player.lastUpdate = Date.now();
    return player;
  }

  private generateRandomPosition(): Position {
    // Generate position within game boundary
    const GAME_WIDTH = 800;
    const GAME_HEIGHT = 600;
    return {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT
    };
  }

  public updatePlayerRespawns(): void {
    const players = this.getAllPlayers();

    for (const player of players) {
      if (player.respawnTimer !== undefined) {
        if (player.respawnTimer > 0) {
          player.respawnTimer--;
        }

        if (player.respawnTimer === 0) {
          // Respawn the player
          this.respawnPlayer(player.id);
        }
      }
    }
  }
}
