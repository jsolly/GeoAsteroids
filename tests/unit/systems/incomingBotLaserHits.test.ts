import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Laser } from '../../../src/entities/laser/Laser';
import { Ship } from '../../../src/entities/ship/Ship';
import { CollisionManager } from '../../../src/physics/collision/CollisionManager';

const mockSendMessage = vi.fn();
const mockUpdatePlayerState = vi.fn();

vi.mock('../../../src/network/networkManager', () => ({
  NetworkManager: {
    getInstance: vi.fn(() => ({
      sendMessage: mockSendMessage,
      updatePlayerState: mockUpdatePlayerState,
    })),
  },
}));

vi.mock('../../../src/utils/Logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('incoming lasers use the shared hull path', () => {
  let collisionManager: CollisionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    collisionManager = CollisionManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('a bot laser that overlaps the local ship reports laserDamage', () => {
    const laser = {
      position: { x: 100, y: 100 },
      velocity: { x: 5, y: 0 },
      distTraveled: 0,
      explodeTime: 0,
      hasExploded: false,
      updateExplodeTime: vi.fn(),
      playHitSound: vi.fn(),
      move: vi.fn(),
      isExpired: vi.fn().mockReturnValue(false),
      shouldBeRemoved: vi.fn().mockReturnValue(false),
      playLaserSound: vi.fn(),
    } as unknown as Laser;

    const localShip = new Ship();
    localShip.position = { x: 100, y: 100 };
    localShip.health = 100;
    localShip.exploding = false;
    localShip.blinkCount = 0;

    collisionManager.checkLaserCollisions(
      [laser],
      [],
      [{ ship: localShip, id: 'human-pilot', type: 'local' }],
      'server-bot-0'
    );

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'laserDamage',
      data: {
        targetPlayerId: 'human-pilot',
        attackerId: 'server-bot-0',
        damage: 25,
      },
    });
  });

  test('spawn-protected local ships do not report incoming laserDamage', () => {
    const laser = {
      position: { x: 100, y: 100 },
      velocity: { x: 5, y: 0 },
      distTraveled: 0,
      explodeTime: 0,
      hasExploded: false,
      updateExplodeTime: vi.fn(),
      playHitSound: vi.fn(),
    } as unknown as Laser;

    const localShip = new Ship();
    localShip.position = { x: 100, y: 100 };
    localShip.health = 100;
    localShip.blinkCount = 4;

    collisionManager.checkLaserCollisions(
      [laser],
      [],
      [{ ship: localShip, id: 'human-pilot', type: 'local' }],
      'server-bot-0'
    );

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
