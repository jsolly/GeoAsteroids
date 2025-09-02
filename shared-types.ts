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
  health: number;
  maxHealth: number;
  lasers?: Array<{
    position: Position;
    velocity: Velocity;
    distTraveled: number;
    explodeTime: number;
    hasExploded: boolean;
  }>;
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
export interface AsteroidData {
  id: string;
  position: Position;
  velocity: Velocity;
  size: number;
  jaggedness: number;
  rotation: number;
  angularVelocity: number;
  health: number;
  maxHealth: number;
}

export interface BotData {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  lives: number;
  health: number;
  maxHealth: number;
}

// Server game state structure (what the server actually sends)
export interface ServerPlayerData {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  rotation: number;
  angularVelocity: number;
  lives: number;
  score: number;
  exploding: boolean;
  health: number;
  maxHealth: number;
  respawnTimer?: number;
}

export interface ServerGameState {
  players: ServerPlayerData[];
  bots: BotData[];
  asteroids: AsteroidData[];
  gameTime: number;
  isPaused: boolean;
}

// Legacy GameState interface for backward compatibility
export interface GameState {
  players: PlayerUpdate[];
  bots: BotData[];
  asteroids: AsteroidData[];
  gameTime: number;
}
