import { Vector } from '../vector.js';

export interface IPlayer {
  id: string;
  name: string;
  position: Vector;
  velocity: Vector;
  r: number;
  a: number;
  lives: number;
  score: number;
  dead: boolean;
  exploding: boolean;
  lastUpdate: number;
  isBot?: boolean; // New field to identify bot players
}

export interface IGameState {
  players: Array<{
    id: string;
    name: string;
    position: Vector;
    velocity: Vector;
    r: number;
    a: number;
    lives: number;
    score: number;
    dead: boolean;
    exploding: boolean;
  }>;
  asteroids: Array<{
    position: Vector;
    size: number;
    jaggedness: number;
  }>;
  gameTime: number;
}

export interface IPlayerUpdate {
  id: string;
  position: Vector;
  velocity: Vector;
  r: number;
  a: number;
  lives: number;
  score: number;
  dead: boolean;
  exploding: boolean;
}

export interface IPlayerJoin {
  id: string;
  name: string;
  position: Vector;
}

export interface IPlayerLeave {
  id: string;
}

export interface IPlayerShoot {
  id: string;
  laserStart: Vector;
  laserDirection: Vector;
}

export interface IBotPlayer extends IPlayer {
  isBot: true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  lastShotTime: number;
  shotCooldown: number;
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;
  explodeTime: number; // Add explosion duration tracking
  thrusterActive: boolean; // Track when bot thruster is active
  respawnTimer?: number; // Timer for respawning after death (in frames)
  respawnPosition?: Vector; // Position where bot will respawn
  lastPosition?: Vector; // Previous position for smoothing
  lastRotation?: number; // Previous rotation for smoothing
  // Invincibility properties (same as player ship)
  blinkOn: boolean; // Whether bot is currently blinking (invulnerable)
  blinkCount: number; // Number of blinks remaining for invincibility
  blinkTime: number; // Time between blinks for invincibility effect
  // Additional spawn protection using wall-clock time to avoid edge cases
  spawnProtectedUntil: number; // Timestamp (ms) until which the bot is invincible
  // Health system properties (same as player ship)
  health: number; // Current health points
  maxHealth: number; // Maximum health points
  lastDamageTime: number; // Timer for health regeneration delay
  healthRegenTimer: number; // Timer for health regeneration
}

export interface IBotShoot {
  botId: string;
  laserStart: Vector;
  laserDirection: Vector;
  targetPlayerId: string;
}

export interface IBotBullet {
  id: string;
  botId: string;
  position: Vector;
  direction: Vector;
  speed: number;
  distanceTraveled: number;
  maxDistance: number;
  createdAt: number;
}

export interface IServerMessage {
  type:
    | 'playerJoin'
    | 'playerLeave'
    | 'playerUpdate'
    | 'playerShoot'
    | 'gameState'
    | 'botShoot'
    | 'error';
  data:
    | IPlayerJoin
    | IPlayerLeave
    | IPlayerUpdate
    | IPlayerShoot
    | IGameState
    | IBotShoot
    | string;
  timestamp: number;
}

export interface IClientMessage {
  type: 'join' | 'leave' | 'update' | 'shoot' | 'botShoot';
  data: IPlayerJoin | IPlayerLeave | IPlayerUpdate | IPlayerShoot | IBotShoot;
  timestamp: number;
}
