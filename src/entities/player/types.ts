import type { Vector } from '../../physics/Vector.ts';
import type { Ship } from '../ship/Ship.ts';

// Player-specific properties that don't exist in Ship
export interface PlayerData {
  id: string;
  name: string;
  lastUpdate: number;
  isBot?: boolean;
}

// Player is now a composition of Ship + Player-specific data
export interface Player extends PlayerData {
  id: string;
  name: string;
  ship: Ship;
  score: number;
  lastUpdate: number;
  isBot?: boolean;
  lives: number;
  respawnTimer?: number; // Timer for respawning after death (in frames)
  respawnPosition?: Vector; // Position where player will respawn
  spawnProtectedUntil: number; // Timestamp (ms) until which the player is invincible
  color: string; // Player's unique color for lasers and other visual elements
  respawn(): void;
  onShipExploded(): void;
}

// Network update interface - only what needs to be synced
export interface PlayerUpdate {
  id: string;
  position: Vector;
  velocity: Vector;
  r: number;
  a: number;
  lives: number;
  score: number;
  exploding: boolean;
}

export interface PlayerJoin {
  id: string;
  name: string;
  position: Vector;
}

export interface PlayerLeave {
  id: string;
}

export interface PlayerShoot {
  id: string;
  laserStart: Vector;
  laserDirection: Vector;
}
