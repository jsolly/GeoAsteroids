import { WebSocket } from 'ws';
import type { Position, Velocity } from '../../shared-types';

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
}

export class PlayerManager {
  private players = new Map<string, ConnectedPlayer>();

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

      // Backward compatibility for old 'a' property (maps to angularVelocity; 'r' refers to ship radius)
      if (updates.a !== undefined) updateData.angularVelocity = updates.a;

      Object.assign(player, updateData);
      player.lastUpdate = Date.now();
    }
    return player;
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
}
