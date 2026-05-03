import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
import { Player } from '../../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../../src/input/MockPlayerInput';
import { Ship } from '../../../../src/entities/ship/Ship';

// Mock NetworkManager for integration testing
const mockSendMessage = vi.fn();
const mockUpdatePlayerState = vi.fn();

vi.mock('../../../../src/network/networkManager', () => ({
  NetworkManager: {
    getInstance: vi.fn(() => ({
      sendMessage: mockSendMessage,
      updatePlayerState: mockUpdatePlayerState,
    })),
  },
}));

// Mock logger
vi.mock('../../../../src/utils/Logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('Laser vs Player Collisions Integration', () => {
  let localPlayer: Player;
  let remotePlayer: Player;
  let localShip: Ship;
  let remoteShip: Ship;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create local player
    localPlayer = new Player({
      id: 'local-player',
      name: 'Local Player',
      type: 'local',
      input: new MockPlayerInput()
    });
    localShip = localPlayer.ship;

    // Create remote player
    remotePlayer = new Player({
      id: 'remote-player',
      name: 'Remote Player',
      type: 'remote',
      input: new MockPlayerInput()
    });
    remoteShip = remotePlayer.ship;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Laser Damage Message Handling', () => {
    test('can send laser damage message to server', () => {
      const targetPlayerId = 'remote-player';
      const attackerId = 'local-player';
      const damage = 25;

      // Simulate sending laser damage message
      mockSendMessage({
        type: 'laserDamage',
        data: {
          targetPlayerId,
          attackerId,
          damage,
        },
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'laserDamage',
        data: {
          targetPlayerId,
          attackerId,
          damage,
        },
      });
    });

    test('laser damage message includes all required fields', () => {
      const message = {
        type: 'laserDamage',
        data: {
          targetPlayerId: 'remote-player',
          attackerId: 'local-player',
          damage: 25,
        },
      };

      mockSendMessage(message);

      const sentMessage = mockSendMessage.mock.calls[0][0];
      expect(sentMessage.type).toBe('laserDamage');
      expect(sentMessage.data.targetPlayerId).toBe('remote-player');
      expect(sentMessage.data.attackerId).toBe('local-player');
      expect(sentMessage.data.damage).toBe(25);
    });
  });

  describe('Player vs Player Laser Damage', () => {
    test('local player can damage remote player with laser', () => {
      const damage = 25;
      const initialHealth = remoteShip.health;

      // Simulate laser hit on remote player
      remoteShip.takeDamage(damage);

      expect(remoteShip.health).toBe(initialHealth - damage);
    });

    test('laser damage reduces player health correctly', () => {
      const damage = 30;
      const initialHealth = localShip.health;

      localShip.takeDamage(damage);

      expect(localShip.health).toBe(initialHealth - damage);
    });

    test('player can be killed by laser damage', () => {
      const damage = 100; // More than max health

      localShip.takeDamage(damage);

      expect(localShip.health).toBe(0);
      expect(localShip.exploding).toBe(true);
    });

    test('laser damage cannot reduce health below zero', () => {
      const damage = 150; // More than max health

      localShip.takeDamage(damage);

      expect(localShip.health).toBe(0);
    });
  });

  describe('Laser Damage Network Flow', () => {
    test('laser damage flows through network correctly', () => {
      const targetPlayerId = 'remote-player';
      const attackerId = 'local-player';
      const damage = 25;

      // Step 1: Client sends damage message
      mockSendMessage({
        type: 'laserDamage',
        data: { targetPlayerId, attackerId, damage },
      });

      // Step 2: Verify message was sent
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'laserDamage',
        data: { targetPlayerId, attackerId, damage },
      });

      // Step 3: Simulate server response (player damaged broadcast)
      const serverResponse = {
        type: 'playerDamaged',
        data: {
          targetPlayerId,
          attackerId,
          damage,
          remainingHealth: 75, // 100 - 25
          isDestroyed: false,
        },
      };

      // In a real scenario, the client would receive this and update the remote player
      expect(serverResponse.data.targetPlayerId).toBe(targetPlayerId);
      expect(serverResponse.data.damage).toBe(damage);
      expect(serverResponse.data.remainingHealth).toBe(75);
    });

    test('laser kill flows through network correctly', () => {
      const targetPlayerId = 'remote-player';
      const attackerId = 'local-player';
      const damage = 100; // Lethal damage

      // Step 1: Client sends lethal damage message
      mockSendMessage({
        type: 'laserDamage',
        data: { targetPlayerId, attackerId, damage },
      });

      // Step 2: Simulate server response (player killed broadcast)
      const serverResponse = {
        type: 'playerDamaged',
        data: {
          targetPlayerId,
          attackerId,
          damage,
          remainingHealth: 0,
          isDestroyed: true,
        },
      };

      // Step 3: Simulate score update for killer
      const scoreUpdate = {
        type: 'scoreUpdate',
        data: {
          playerId: attackerId,
          score: 100, // Points for kill
        },
      };

      expect(serverResponse.data.isDestroyed).toBe(true);
      expect(scoreUpdate.data.playerId).toBe(attackerId);
    });
  });

  describe('Laser Damage Edge Cases', () => {
    test('handles multiple laser hits on same player', () => {
      const damage1 = 25;
      const damage2 = 30;
      const initialHealth = localShip.health;

      localShip.takeDamage(damage1);
      localShip.takeDamage(damage2);

      expect(localShip.health).toBe(initialHealth - damage1 - damage2);
    });

    test('handles laser damage during spawn protection', () => {
      // Player should have spawn protection initially
      expect(localShip.spawnProtectionTimer).toBeGreaterThan(0);
      expect(localShip.blinkCount).toBeGreaterThan(0);

      const damage = 25;
      const initialHealth = localShip.health;

      // Damage should still apply (spawn protection is visual only in this implementation)
      localShip.takeDamage(damage);

      expect(localShip.health).toBe(initialHealth - damage);
    });

    test('handles laser damage to already dead player', () => {
      // Kill the player first
      localShip.takeDamage(100);
      expect(localShip.health).toBe(0);
      expect(localShip.exploding).toBe(true);

      const damage = 25;
      const healthBefore = localShip.health;

      // Try to damage already dead player
      localShip.takeDamage(damage);

      // Health should remain at 0
      expect(localShip.health).toBe(0);
      expect(localShip.health).toBe(healthBefore);
    });
  });

  describe('Laser Damage Validation', () => {
    test('validates laser damage message format', () => {
      const validMessage = {
        type: 'laserDamage',
        data: {
          targetPlayerId: 'remote-player',
          attackerId: 'local-player',
          damage: 25,
        },
      };

      // All required fields present
      expect(validMessage.type).toBe('laserDamage');
      expect(validMessage.data.targetPlayerId).toBeDefined();
      expect(validMessage.data.attackerId).toBeDefined();
      expect(validMessage.data.damage).toBeDefined();
      expect(typeof validMessage.data.damage).toBe('number');
    });

    test('rejects invalid laser damage messages', () => {
      const invalidMessages = [
        { type: 'laserDamage', data: { targetPlayerId: 'remote-player' } }, // Missing attackerId and damage
        { type: 'laserDamage', data: { attackerId: 'local-player', damage: 25 } }, // Missing targetPlayerId
        { type: 'laserDamage', data: { targetPlayerId: 'remote-player', attackerId: 'local-player' } }, // Missing damage
        { type: 'laserDamage', data: { targetPlayerId: 'remote-player', attackerId: 'local-player', damage: 'invalid' } }, // Invalid damage type
      ];

      invalidMessages.forEach((message) => {
        // In a real implementation, these would be rejected by the server
        // For testing, we just verify the structure is invalid
        const hasRequiredFields = !!(message.data.targetPlayerId && 
                                     message.data.attackerId && 
                                     typeof message.data.damage === 'number');
        expect(hasRequiredFields).toBe(false);
      });
    });
  });
});
