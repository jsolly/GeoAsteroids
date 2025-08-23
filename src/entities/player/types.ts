import type { Ship } from '../ship/Ship';

// Common position and velocity types used throughout the system
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  ship: Ship;
  score: number;
  lastUpdate: number;
  lives: number;
  respawnTimer?: number; // Timer for respawning after death (in frames)
  respawnPosition?: Position; // Position where player will respawn
  spawnProtectedUntil: number; // Timestamp (ms) until which the player is invincible
  color: string; // Player's unique color for lasers and other visual elements
  respawn(): void;
  onShipExploded(): void;
  update(): void;
  get isDead(): boolean;
  handleLifeLost(): void;
}

// Network update interface - only what needs to be synced
export interface PlayerUpdate {
  id: string;
  position: Position;
  velocity: Velocity;
  r: number;
  angle: number;
  lives: number;
  score: number;
  exploding: boolean;
}

export interface PlayerJoin {
  id: string;
  name: string;
  position: Position;
}

export interface PlayerLeave {
  id: string;
}

export interface PlayerShoot {
  id: string;
  laserStart: Position;
  laserDirection: Velocity;
}
