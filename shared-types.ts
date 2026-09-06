// Shared types between client and server
// These types are used in network communication and should be identical on both sides

/** Soft sides for readability + same-side cooperation. Not a team win condition. */
export type FactionId = 'ion' | 'ember';

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
/** Chosen at join. Shared by human and bot ships. Independent of soft faction. */
export type ShipKitId = 'dart' | 'hauler' | 'warden' | 'skirmisher' | 'quake';

/** Soft side (ION / EMBER). Assigned on join by the factions stream. */
export type SoftFactionId = 'ion' | 'ember';

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
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
  mass?: number;
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
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
  /** Seeded heightfield shared by every client in the room. */
  terrainSeed?: number;
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
  /** High-HP rock that stacks hits from every pilot (voluntary coop). */
  isCollabTarget?: boolean;
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
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
  mass?: number;
  shieldActive?: boolean;
  shieldTime?: number;
  shieldCooldown?: number;
  shieldFlashTime?: number;
}

/** Shared world pickups. Kill loot is wreckage; destroy-drop is shard; fuel later. */
export type LootKind = 'shard' | 'wreckage' | 'fuel';

export interface LootData {
  id: string;
  position: Position;
  mass: number;
  radius: number;
  kind: LootKind;
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
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
  shieldActive?: boolean;
  shieldTime?: number;
  shieldCooldown?: number;
  shieldFlashTime?: number;
}

/** Server-owned collab tag. Clients must not destroy the roid until asteroidDestroy. */
export interface AsteroidTaggedEvent {
  asteroidId: string;
  shooterId: string;
  expiresAt: number;
}

/** Authoritative destroy. `origin` + `collabSplit` are the #447 shockwave hook. */
export interface AsteroidDestroyEvent {
  asteroidId: string;
  collabSplit?: boolean;
  origin?: Position;
}

export interface ShockwaveEvent {
  origin: Position;
  asteroidId?: string;
}

export interface ServerGameState {
  entities: ServerEntityData[];
  asteroids: AsteroidData[];
  loot: LootData[];
  gameTime: number;
  isPaused: boolean;
  /** Same seed on every client → same contours and slope field. */
  terrainSeed?: number;
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
  mass: number;
  respawnTimer?: number;
  spawnProtectionTimer?: number;
  kitId?: ShipKitId;
  factionId?: SoftFactionId;
  abilityCooldownFrames?: number;
  abilityActiveFrames?: number;
  shieldTimer?: number;
  harpoonTimer?: number;
  harpoonTargetId?: string;
  /** Last killer token (boundary, asteroid, player/bot id). Omitted after respawn. */
  deathCause?: string;
  shieldActive?: boolean;
  shieldTime?: number;
  shieldCooldown?: number;
  shieldFlashTime?: number;
}
