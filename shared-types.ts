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
  color: string;
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
  vertices: number;
  offsets: number[];
}

export interface BotData {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  thrusting: boolean;
  color: string;
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
  thrusting: boolean;
  color: string;
  health: number;
  maxHealth: number;
  respawnTimer?: number;
}

export interface SatelliteData {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  color: string;
  health: number;
  maxHealth: number;
  radius: number;
}

export interface SatelliteShoot {
  id: string;
  laserStart: Position;
  laserDirection: Velocity;
}

export interface ServerGameState {
  entities: ServerEntityData[];
  asteroids: AsteroidData[];
  satellites: SatelliteData[];
  gameTime: number;
  isPaused: boolean;
}

export interface ServerEntityData {
  id: string;
  name: string;
  type: 'human' | 'bot';
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  thrusting: boolean;
  color: string;
  lives: number;
  score: number;
  health: number;
  maxHealth: number;
  respawnTimer?: number;
  spawnProtectionTimer?: number;
}
