import type {
  AsteroidData,
  Position,
  ServerEntityData,
  ServerGameState,
  Velocity,
  WireAsteroidSnapshot,
  WireEntitySnapshot,
} from '../../shared-types';

/** 0.1 px — plenty for a ~3100 px arena and identical across clients. */
export const QUANTIZE_POSITION = 1;
/** 0.01 px/tick — velocity is nearly constant between collisions. */
export const QUANTIZE_VELOCITY = 2;
/** ~0.057° — rotation is visual; pose still matches after quantize. */
export const QUANTIZE_ANGLE = 3;
export const QUANTIZE_ANGULAR_VELOCITY = 5;
export const QUANTIZE_SHAPE = 3;

/** Full keyframe every 30 broadcasts (~1 s at 30 Hz) for late join / recovery. */
export const GAME_STATE_KEYFRAME_EVERY = 30;

export interface CanonicalGameState {
  entities: ServerEntityData[];
  asteroids: AsteroidData[];
  gameTime: number;
  isPaused: boolean;
}

export function quantizeNumber(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function quantizeVec(vec: Position | Velocity, decimals: number): Position {
  return {
    x: quantizeNumber(vec.x, decimals),
    y: quantizeNumber(vec.y, decimals),
  };
}

function vecEqual(a: Position | Velocity, b: Position | Velocity): boolean {
  return a.x === b.x && a.y === b.y;
}

function offsetsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function quantizeAsteroid(asteroid: AsteroidData): AsteroidData {
  return {
    id: asteroid.id,
    position: quantizeVec(asteroid.position, QUANTIZE_POSITION),
    velocity: quantizeVec(asteroid.velocity, QUANTIZE_VELOCITY),
    size: quantizeNumber(asteroid.size, QUANTIZE_SHAPE),
    jaggedness: quantizeNumber(asteroid.jaggedness, QUANTIZE_SHAPE),
    rotation: quantizeNumber(asteroid.rotation, QUANTIZE_ANGLE),
    angularVelocity: quantizeNumber(asteroid.angularVelocity, QUANTIZE_ANGULAR_VELOCITY),
    health: asteroid.health,
    maxHealth: asteroid.maxHealth,
    vertices: asteroid.vertices,
    offsets: asteroid.offsets.map((offset) => quantizeNumber(offset, QUANTIZE_SHAPE)),
  };
}

export function quantizeAsteroids(asteroids: AsteroidData[]): AsteroidData[] {
  return asteroids.map(quantizeAsteroid);
}

export function quantizeEntity(entity: ServerEntityData): ServerEntityData {
  const quantized: ServerEntityData = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    position: quantizeVec(entity.position, QUANTIZE_POSITION),
    velocity: quantizeVec(entity.velocity, QUANTIZE_VELOCITY),
    angle: quantizeNumber(entity.angle, QUANTIZE_ANGLE),
    exploding: entity.exploding,
    thrusting: entity.thrusting,
    color: entity.color,
    lives: entity.lives,
    score: entity.score,
    health: entity.health,
    maxHealth: entity.maxHealth,
  };
  if (entity.respawnTimer !== undefined) {
    quantized.respawnTimer = entity.respawnTimer;
  }
  if (entity.spawnProtectionTimer !== undefined) {
    quantized.spawnProtectionTimer = entity.spawnProtectionTimer;
  }
  return quantized;
}

export function quantizeGameState(raw: CanonicalGameState): CanonicalGameState {
  return {
    entities: raw.entities.map(quantizeEntity),
    asteroids: raw.asteroids.map(quantizeAsteroid),
    gameTime: raw.gameTime,
    isPaused: raw.isPaused,
  };
}

function encodeEntityDelta(
  current: ServerEntityData,
  previous: ServerEntityData | undefined
): WireEntitySnapshot {
  if (!previous) {
    return current;
  }

  const wire: WireEntitySnapshot = { id: current.id };
  if (!vecEqual(current.position, previous.position)) {
    wire.position = current.position;
  }
  if (!vecEqual(current.velocity, previous.velocity)) {
    wire.velocity = current.velocity;
  }
  if (current.angle !== previous.angle) {
    wire.angle = current.angle;
  }
  if (current.exploding !== previous.exploding) {
    wire.exploding = current.exploding;
  }
  if (current.thrusting !== previous.thrusting) {
    wire.thrusting = current.thrusting;
  }
  if (current.lives !== previous.lives) {
    wire.lives = current.lives;
  }
  if (current.score !== previous.score) {
    wire.score = current.score;
  }
  if (current.health !== previous.health) {
    wire.health = current.health;
  }
  if (current.maxHealth !== previous.maxHealth) {
    wire.maxHealth = current.maxHealth;
  }
  if (current.name !== previous.name) {
    wire.name = current.name;
  }
  if (current.type !== previous.type) {
    wire.type = current.type;
  }
  if (current.color !== previous.color) {
    wire.color = current.color;
  }
  if (current.respawnTimer !== previous.respawnTimer) {
    wire.respawnTimer = current.respawnTimer ?? 0;
  }
  if (current.spawnProtectionTimer !== previous.spawnProtectionTimer) {
    wire.spawnProtectionTimer = current.spawnProtectionTimer ?? 0;
  }
  return wire;
}

function encodeAsteroidDelta(
  current: AsteroidData,
  previous: AsteroidData | undefined
): WireAsteroidSnapshot {
  if (!previous) {
    return current;
  }

  const wire: WireAsteroidSnapshot = { id: current.id };
  if (!vecEqual(current.position, previous.position)) {
    wire.position = current.position;
  }
  if (!vecEqual(current.velocity, previous.velocity)) {
    wire.velocity = current.velocity;
  }
  if (current.rotation !== previous.rotation) {
    wire.rotation = current.rotation;
  }
  if (current.angularVelocity !== previous.angularVelocity) {
    wire.angularVelocity = current.angularVelocity;
  }
  if (current.health !== previous.health) {
    wire.health = current.health;
  }
  if (current.maxHealth !== previous.maxHealth) {
    wire.maxHealth = current.maxHealth;
  }
  if (current.size !== previous.size) {
    wire.size = current.size;
  }
  if (current.jaggedness !== previous.jaggedness) {
    wire.jaggedness = current.jaggedness;
  }
  if (current.vertices !== previous.vertices) {
    wire.vertices = current.vertices;
  }
  if (!offsetsEqual(current.offsets, previous.offsets)) {
    wire.offsets = current.offsets;
  }
  return wire;
}

export function encodeGameStateSnapshot(
  raw: CanonicalGameState,
  previous: CanonicalGameState | null,
  options?: { full?: boolean }
): { wire: ServerGameState; baseline: CanonicalGameState } {
  const baseline = quantizeGameState(raw);
  const full = options?.full === true || previous === null;

  if (full) {
    return {
      wire: {
        entities: baseline.entities,
        asteroids: baseline.asteroids,
        gameTime: baseline.gameTime,
        isPaused: baseline.isPaused,
        full: true,
      },
      baseline,
    };
  }

  const previousEntities = new Map(previous.entities.map((entity) => [entity.id, entity]));
  const previousAsteroids = new Map(previous.asteroids.map((asteroid) => [asteroid.id, asteroid]));

  return {
    wire: {
      entities: baseline.entities.map((entity) =>
        encodeEntityDelta(entity, previousEntities.get(entity.id))
      ),
      asteroids: baseline.asteroids.map((asteroid) =>
        encodeAsteroidDelta(asteroid, previousAsteroids.get(asteroid.id))
      ),
      gameTime: baseline.gameTime,
      isPaused: baseline.isPaused,
    },
    baseline,
  };
}

export function mergeWireGameState(
  previous: CanonicalGameState | null,
  wire: ServerGameState
): CanonicalGameState {
  if (wire.full || !previous) {
    return {
      entities: wire.entities.map((entity) => entity as ServerEntityData),
      asteroids: wire.asteroids.filter(asteroidHasWireShape) as AsteroidData[],
      gameTime: wire.gameTime,
      isPaused: wire.isPaused,
    };
  }

  const previousEntities = new Map(previous.entities.map((entity) => [entity.id, entity]));
  const previousAsteroids = new Map(previous.asteroids.map((asteroid) => [asteroid.id, asteroid]));

  const entities: ServerEntityData[] = [];
  for (const wireEntity of wire.entities) {
    const prior = previousEntities.get(wireEntity.id);
    if (!prior) {
      entities.push(wireEntity as ServerEntityData);
      continue;
    }
    entities.push({
      ...prior,
      ...wireEntity,
      position: wireEntity.position ?? prior.position,
      velocity: wireEntity.velocity ?? prior.velocity,
    });
  }

  const asteroids: AsteroidData[] = [];
  for (const wireAsteroid of wire.asteroids) {
    const prior = previousAsteroids.get(wireAsteroid.id);
    if (!prior) {
      if (asteroidHasWireShape(wireAsteroid)) {
        asteroids.push(wireAsteroid as AsteroidData);
      }
      continue;
    }
    asteroids.push({
      ...prior,
      ...wireAsteroid,
      position: wireAsteroid.position ?? prior.position,
      velocity: wireAsteroid.velocity ?? prior.velocity,
      offsets: wireAsteroid.offsets ?? prior.offsets,
    });
  }

  return {
    entities,
    asteroids,
    gameTime: wire.gameTime,
    isPaused: wire.isPaused,
  };
}

export function asteroidHasWireShape(asteroid: WireAsteroidSnapshot): asteroid is AsteroidData {
  return (
    asteroid.position !== undefined &&
    asteroid.velocity !== undefined &&
    typeof asteroid.size === 'number' &&
    typeof asteroid.jaggedness === 'number' &&
    typeof asteroid.rotation === 'number' &&
    typeof asteroid.angularVelocity === 'number' &&
    typeof asteroid.health === 'number' &&
    typeof asteroid.maxHealth === 'number' &&
    typeof asteroid.vertices === 'number' &&
    Array.isArray(asteroid.offsets) &&
    asteroid.offsets.length > 0
  );
}

export function jsonUtf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function shouldSendFullKeyframe(broadcastSeq: number): boolean {
  return broadcastSeq % GAME_STATE_KEYFRAME_EVERY === 0;
}

/** After asteroidCreateBatch, remember shape so the next gameState can omit it. */
export function mergeAsteroidsIntoBaseline(
  baseline: CanonicalGameState | null,
  asteroids: AsteroidData[]
): CanonicalGameState | null {
  if (!baseline) {
    return null;
  }
  const byId = new Map(baseline.asteroids.map((asteroid) => [asteroid.id, asteroid]));
  for (const asteroid of quantizeAsteroids(asteroids)) {
    byId.set(asteroid.id, asteroid);
  }
  return {
    ...baseline,
    asteroids: [...byId.values()],
  };
}
