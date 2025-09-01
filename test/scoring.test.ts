import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Laser } from '../src/entities/laser/Laser';
import { Player } from '../src/entities/player/Player';
import type { Roid, RoidBelt } from '../src/entities/roid/Roid';
import { Ship } from '../src/entities/ship/Ship';
import { CollisionManager } from '../src/physics/CollisionManager';

// Mock the constants
vi.mock('../src/constants', () => ({
  DEBUG: false,
  LASER_EXPLODE_DUR: 0.1,
  FPS: 60,
  SHIP_INV_DUR_FRAMES: 180,
  SHIP_INV_BLINK_DUR_FRAMES: 6,
  SHIP_MAX_HEALTH: 100,
  SHIP_SIZE: 30,
  START_LIVES: 3,
  LASER_SPEED: 300,
  LASER_MAX: 200,
  LASER_DIST: 0.6,
  SHIP_THRUST: 5,
  FRICTION: 0.98,
  EMP_PULSE_DURATION: 0.5,
  SHIP_HEALTH_REGEN_RATE: 1,
  SHIP_HEALTH_REGEN_DELAY: 5,
  NEXT_LEVEL_POINTS: 1000,
  START_LEVEL: 1,
  STARTING_SCORE: 0,
  SHIP_EXPLODE_DUR_FRAMES: 18,
  getCVS: () => ({}),
  soundIsOn: () => true,
  SHIP_COLLISION_DAMAGE: 20,
  LOGGING: {
    GLOBAL_LOG_LEVEL: 'info',
  },
  GAME: {
    BOT_COUNT: 3,
  },
  SHIP: {
    COLLISION_DAMAGE: 20,
  },
  LASER: {
    SPEED: 300,
  },
  EMP: {
    PULSE_DURATION: 0.5,
  },
}));

// Mock the MultiplayerManager
vi.mock('../src/multiplayer/multiplayerManager.ts', () => ({
  MultiplayerManager: {
    getInstance: vi.fn(() => ({
      isConnected: true, // Multiplayer mode only
      laserDamagePlayer: vi.fn(),
      laserDamageBot: vi.fn(),
      handleAsteroidDestruction: vi.fn(),
      asteroidDestroyed: vi.fn(),
    })),
  },
}));

// Mock the sound effects
vi.mock('../src/entities/roid/Roid.ts', () => ({
  Roid: {
    fxHit: {
      play: vi.fn(),
    },
  },
}));

// Mock the playSound function
vi.mock('../src/audio/Sound.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../src/audio/Sound.ts');
  return {
    ...actual,
    playSound: vi.fn(),
  };
});

describe('Scoring System', () => {
  let collisionManager: CollisionManager;
  let localPlayer: Player;
  let roidBelt: RoidBelt;

  beforeEach(() => {
    collisionManager = CollisionManager.getInstance();

    // Create a local player
    localPlayer = Player.createPlayer({
      id: 'local-player',
      name: 'LocalPlayer',
      type: 'local',
      position: { x: 0, y: 0 },
    });
    localPlayer.score = 0;
    localPlayer.ship = new Ship();
    localPlayer.ship.position = { x: 0, y: 0 };
    localPlayer.ship.lasers = [];

    // Create a roid belt with one roid
    roidBelt = {
      roidNum: 1,
      roids: [
        {
          id: 'roid-1',
          position: { x: 100, y: 0 },
          velocity: { x: 0, y: 0 },
          angle: 0,
          size: 20,
          angularVelocity: 0,
          health: 100,
          maxHealth: 100,
          r: 20,
          vertices: 8,
          offsets: [1, 1, 1, 1, 1, 1, 1, 1],
          jaggedness: 0.3,
          points: 50,
          move: vi.fn(),
          render: vi.fn(),
        } as Roid,
      ],
      minCount: 5,
      maxCount: 20,
      initialCount: 10,
      spawnTimer: 0,
      addRoid: vi.fn(),
      destroyRoid: vi.fn(() => ({ score: 50, newRoids: [] })),
      moveRoids: vi.fn(),
      spawnRoids: vi.fn(),
      getRoids: vi.fn(() => []),
      setRoidLimits: vi.fn(),
    } as RoidBelt;
  });

  it('should handle asteroid destruction in multiplayer mode', () => {
    // Create a laser that will hit the roid
    const laser = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    localPlayer.ship.lasers = [laser];

    // Run collision detection
    const result = collisionManager.detectAllCollisions(localPlayer, roidBelt);

    // Server handles all points in multiplayer mode
    expect(result.laserScore).toBe(0);
    expect(localPlayer.score).toBe(0);
  });

  it('should handle hitting bots in multiplayer mode', () => {
    // Create a bot player
    const botPlayer = Player.createPlayer({
      id: 'bot-1',
      name: 'Bot1',
      type: 'bot',
      position: { x: 100, y: 0 },
    });
    botPlayer.ship = new Ship();
    botPlayer.ship.position = { x: 100, y: 0 };
    botPlayer.ship.health = 100;
    botPlayer.ship.maxHealth = 100;

    // Create a laser that will hit the bot
    const laser = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    localPlayer.ship.lasers = [laser];

    // Run collision detection
    const result = collisionManager.detectAllCollisions(localPlayer, roidBelt, [botPlayer]);

    // Server handles all points in multiplayer mode
    expect(result.laserScore).toBe(0);
    expect(localPlayer.score).toBe(0);
  });

  it('should handle hitting players in multiplayer mode', () => {
    // Create a remote player
    const remotePlayer = Player.createPlayer({
      id: 'remote-1',
      name: 'Remote1',
      type: 'remote',
      position: { x: 100, y: 0 },
    });
    remotePlayer.ship = new Ship();
    remotePlayer.ship.position = { x: 100, y: 0 };
    remotePlayer.ship.health = 100;
    remotePlayer.ship.maxHealth = 100;

    // Create a laser that will hit the remote player
    const laser = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    localPlayer.ship.lasers = [laser];

    // Run collision detection
    const result = collisionManager.detectAllCollisions(localPlayer, roidBelt, [remotePlayer]);

    // Server handles all points in multiplayer mode
    expect(result.laserScore).toBe(0);
    expect(localPlayer.score).toBe(0);
  });

  it('should handle multiple collision sources', () => {
    // Create a bot player at a different position
    const botPlayer = Player.createPlayer({
      id: 'bot-1',
      name: 'Bot1',
      type: 'bot',
      position: { x: 200, y: 0 },
    });
    botPlayer.ship = new Ship();
    botPlayer.ship.position = { x: 200, y: 0 };
    botPlayer.ship.health = 100;
    botPlayer.ship.maxHealth = 100;

    // Create two lasers - one for roid at (100,0), one for bot at (200,0)
    const laser1 = new Laser({ x: 100, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    const laser2 = new Laser({ x: 200, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    localPlayer.ship.lasers = [laser1, laser2];

    // Run collision detection
    const result = collisionManager.detectAllCollisions(localPlayer, roidBelt, [botPlayer]);

    // Server handles all points in multiplayer mode
    expect(result.laserScore).toBe(0);
    expect(localPlayer.score).toBe(0);
  });
});
