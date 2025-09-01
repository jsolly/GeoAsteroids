import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIP } from '../src/constants';
import { Laser } from '../src/entities/laser/Laser';
import { Player } from '../src/entities/player/Player';
import { detectLaserPlayerCollisions } from '../src/physics/collision/laserCollisions';

// Create mock functions
const mockLaserDamagePlayer = vi.fn();

// Mock the multiplayer manager
vi.mock('../src/multiplayer/multiplayerManager', () => ({
  MultiplayerManager: {
    getInstance: vi.fn(() => ({
      isConnected: true,
      laserDamagePlayer: mockLaserDamagePlayer,
    })),
  },
}));

// Mock the laser methods to avoid issues
vi.mock('../src/entities/laser/Laser', () => ({
  Laser: vi
    .fn()
    .mockImplementation((position, velocity, distTraveled, explodeTime, hasExploded) => ({
      position,
      velocity,
      distTraveled,
      explodeTime,
      hasExploded,
      playHitSound: vi.fn(),
      updateExplodeTime: vi.fn(),
    })),
}));

describe('Remote Player Damage - Server Authority', () => {
  let localPlayer: Player;
  let remotePlayer: Player;

  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();

    // Create a local player
    localPlayer = Player.createPlayer({
      id: 'local-player',
      name: 'LocalPlayer',
      type: 'local',
      position: { x: 0, y: 0 },
    });

    // Create a remote player
    remotePlayer = Player.createPlayer({
      id: 'remote-player',
      name: 'RemotePlayer',
      type: 'remote',
      position: { x: 100, y: 0 },
    });

    // Set up ship with laser
    const laser = new Laser({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, 0, false);
    localPlayer.ship.lasers = [laser];

    // Set ship radius for collision detection
    localPlayer.ship.r = 15;
    remotePlayer.ship.r = 15;

    // Ensure remote player is not invincible
    remotePlayer.ship.blinkCount = 0;
    remotePlayer.spawnProtectedUntil = Date.now() - 1000; // Spawn protection expired
  });

  it('should send damage request to server for remote player hits', () => {
    // Position laser to hit remote player (within collision threshold)
    const laser = localPlayer.ship.lasers[0];
    laser.position = { x: 85, y: 0 }; // Within 15 + 2 = 17 pixels of remote player at x=100

    // Detect collision
    const score = detectLaserPlayerCollisions(localPlayer, [remotePlayer]);

    // Should call server damage method
    expect(mockLaserDamagePlayer).toHaveBeenCalledWith('remote-player', SHIP.COLLISION_DAMAGE);

    // Should not award local points for remote player hits
    expect(score).toBe(0);

    // Remote player health should not change locally (server-authoritative)
    expect(remotePlayer.ship.health).toBe(100);
  });

  it('should not award points for local player hits (server handles scoring)', () => {
    // Create a local player to hit
    const otherLocalPlayer = Player.createPlayer({
      id: 'other-local',
      name: 'OtherLocal',
      type: 'local',
      position: { x: 100, y: 0 },
    });
    otherLocalPlayer.ship.r = 15;

    // Position laser to hit other local player
    const laser = localPlayer.ship.lasers[0];
    laser.position = { x: 85, y: 0 }; // Within collision threshold

    // Detect collision
    const score = detectLaserPlayerCollisions(localPlayer, [otherLocalPlayer]);

    // Server handles all points in multiplayer mode
    expect(score).toBe(0);

    // Should apply damage locally
    expect(otherLocalPlayer.ship.health).toBe(100 - SHIP.COLLISION_DAMAGE);
  });

  it('should not call server for local player damage', () => {
    // Create a local player to hit
    const otherLocalPlayer = Player.createPlayer({
      id: 'other-local',
      name: 'OtherLocal',
      type: 'local',
      position: { x: 100, y: 0 },
    });
    otherLocalPlayer.ship.r = 15;

    // Position laser to hit other local player
    const laser = localPlayer.ship.lasers[0];
    laser.position = { x: 85, y: 0 }; // Within collision threshold

    // Detect collision
    detectLaserPlayerCollisions(localPlayer, [otherLocalPlayer]);

    // Should not call server for local player damage
    expect(mockLaserDamagePlayer).not.toHaveBeenCalled();
  });
});
