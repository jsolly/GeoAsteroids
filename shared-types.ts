// Shared types between client and server
// These types are used in network communication and should be identical on both sides

// Common position and velocity types used throughout the system
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

// Network update interface - only what needs to be synced
export interface PlayerUpdate {
  id: string;
  name: string;
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

// Game state types that might be shared
export interface GameState {
  players: PlayerUpdate[];
  roids: Array<{ position: Position; size: number; jaggedness: number }>;
  gameTime: number;
}
