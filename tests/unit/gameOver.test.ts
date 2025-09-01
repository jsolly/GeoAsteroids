import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../../src/core/gameController';
import { Player } from '../../src/entities/player/Player';

// Mock the multiplayer manager
vi.mock('../../src/multiplayer/multiplayerManager', () => ({
  MultiplayerManager: {
    getInstance: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      isConnected: true,
      initializeAsteroidSync: vi.fn(),
      setAsteroidBelt: vi.fn(),
      laserDamagePlayer: vi.fn(),
      sendShootEvent: vi.fn(),
    })),
  },
}));

// Mock the entity factory
vi.mock('../../src/entities/EntityFactory', () => ({
  entityFactory: {
    createEmptyRoidBelt: vi.fn(() => ({
      roids: [],
      destroyRoid: vi.fn(() => ({ score: 0, newRoids: [] })),
    })),
  },
}));

describe('Game Over with Death Cause', () => {
  let gameController: GameController;
  let localPlayer: Player;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a fresh game controller
    gameController = GameController.getInstance();

    // Create a local player
    localPlayer = Player.createPlayer({
      id: 'test-player',
      name: 'TestPlayer',
      type: 'local',
      position: { x: 0, y: 0 },
    });

    // Set up the player manager to return our test player
    const playerManager = gameController.getPlayerManager();
    vi.spyOn(playerManager, 'getLocalPlayer').mockReturnValue(localPlayer);
  });

  it('should track asteroid death cause', () => {
    // Simulate asteroid collision death
    localPlayer.lives = 1; // Last life
    localPlayer.ship.health = 100;

    // Trigger asteroid collision
    localPlayer.ship.takeDamage(100); // This should kill the ship

    // The ship should explode with asteroid cause
    expect(localPlayer.ship.exploding).toBe(true);

    // Simulate the explosion event
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: localPlayer.ship.id,
        cause: 'asteroid',
      },
    });

    // Dispatch the event
    window.dispatchEvent(explosionEvent);

    // Check that death cause was recorded
    expect(localPlayer.deathCause).toBe(
      'colliding with an asteroid. Space rocks are not your friends!'
    );
  });

  it('should track boundary death cause', () => {
    // Simulate boundary collision death
    localPlayer.lives = 1; // Last life

    // Simulate the explosion event with boundary cause
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: localPlayer.ship.id,
        cause: 'boundary',
      },
    });

    // Dispatch the event
    window.dispatchEvent(explosionEvent);

    // Check that death cause was recorded
    expect(localPlayer.deathCause).toBe(
      'colliding with the boundary. What a goof! Did you forget how to fly?'
    );
  });

  it('should track player death cause with killer name', () => {
    // Simulate player collision death
    localPlayer.lives = 1; // Last life

    // Simulate the explosion event with player cause and killer name
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: localPlayer.ship.id,
        cause: 'player',
        killerName: 'EnemyPlayer',
      },
    });

    // Dispatch the event
    window.dispatchEvent(explosionEvent);

    // Check that death cause was recorded
    expect(localPlayer.deathCause).toBe('colliding with EnemyPlayer. Maybe try dodging next time?');
  });

  it('should track laser death cause with killer name', () => {
    // Simulate laser death
    localPlayer.lives = 1; // Last life

    // Simulate the explosion event with laser cause and killer name
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: localPlayer.ship.id,
        cause: 'laser',
        killerName: 'SniperPlayer',
      },
    });

    // Dispatch the event
    window.dispatchEvent(explosionEvent);

    // Check that death cause was recorded
    expect(localPlayer.deathCause).toBe("SniperPlayer's laser. Pew pew, you got zapped!");
  });

  it('should format unknown death cause', () => {
    // Simulate unknown death cause
    localPlayer.lives = 1; // Last life

    // Simulate the explosion event with unknown cause
    const explosionEvent = new CustomEvent('shipExploded', {
      detail: {
        shipId: localPlayer.ship.id,
        cause: 'unknown_cause',
      },
    });

    // Dispatch the event
    window.dispatchEvent(explosionEvent);

    // Check that death cause was recorded as the original cause
    expect(localPlayer.deathCause).toBe('unknown_cause');
  });

  it('should handle life loss event with death cause', () => {
    // Set up game controller to handle death events
    const gameStateManager = gameController.getGameStateManager();
    const updateTextSpy = vi.spyOn(gameStateManager, 'updateTextProperties');

    // Simulate death event (life loss, not game over)
    const deathEvent = new CustomEvent('playerDied', {
      detail: {
        playerId: localPlayer.id,
        deathCause: 'colliding with an asteroid. Space rocks are not your friends!',
        isGameOver: false,
      },
    });

    // Dispatch the event
    window.dispatchEvent(deathEvent);

    // Death messages are now handled by GameLoopManager during respawn, not immediately
    // So we don't expect updateTextProperties to be called here
    expect(updateTextSpy).not.toHaveBeenCalled();
  });

  it('should handle game over event with death cause', () => {
    // Set up game controller to handle game over
    const gameStateManager = gameController.getGameStateManager();
    const updateTextSpy = vi.spyOn(gameStateManager, 'updateTextProperties');

    // Simulate death event (game over)
    const deathEvent = new CustomEvent('playerDied', {
      detail: {
        playerId: localPlayer.id,
        deathCause: 'colliding with an asteroid. Space rocks are not your friends!',
        isGameOver: true,
      },
    });

    // Dispatch the event
    window.dispatchEvent(deathEvent);

    // Check that the game over text was updated with death cause
    expect(updateTextSpy).toHaveBeenCalledWith(
      'Game Over: You were killed by colliding with an asteroid. Space rocks are not your friends!',
      1.0
    );
  });

  it('should delay game over event until after explosion animation', () => {
    // Simulate final death (no lives remaining)
    localPlayer.lives = 0; // No lives left
    localPlayer.ship.health = 100;

    // Mock setTimeout to capture the delay
    const originalSetTimeout = global.setTimeout;
    const setTimeoutSpy = vi.fn();
    global.setTimeout = setTimeoutSpy as unknown as typeof global.setTimeout;

    try {
      // Trigger ship explosion
      localPlayer.ship.takeDamage(100); // This should kill the ship

      // Simulate the explosion event
      const explosionEvent = new CustomEvent('shipExploded', {
        detail: {
          shipId: localPlayer.ship.id,
          cause: 'asteroid',
        },
      });

      // Dispatch the event
      window.dispatchEvent(explosionEvent);

      // Verify that setTimeout was called with the correct delay
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

      // Find the setTimeout call that matches our expected delay
      const setTimeoutCalls = setTimeoutSpy.mock.calls;
      const expectedDelay = (18 / 60) * 1000; // EXPLODE_DURATION_FRAMES / GAME.FPS * 1000

      const playerSetTimeoutCall = setTimeoutCalls.find((call) => call[1] === expectedDelay);
      expect(playerSetTimeoutCall).toBeDefined();

      // Verify the callback function dispatches the game over event
      const callback = playerSetTimeoutCall?.[0];

      // Mock window.dispatchEvent to capture the game over event
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      // Call the setTimeout callback
      callback();

      // Verify that the game over event was dispatched
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'playerGameOver',
          detail: {
            playerId: localPlayer.id,
            deathCause: 'colliding with an asteroid. Space rocks are not your friends!',
          },
        })
      );
    } finally {
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    }
  });

  it('should track bot collision death cause with bot name', () => {
    // Create a bot player
    const botPlayer = Player.createPlayer({
      id: 'bot-1',
      name: 'Crimson Falcon',
      type: 'bot',
      position: { x: 100, y: 0 },
    });

    // Simulate local player collision with bot
    localPlayer.lives = 1; // Last life
    localPlayer.ship.health = 100;

    // Simulate the collision by calling takeDamage (will auto-explode)
    localPlayer.ship.takeDamage(100, 'player', botPlayer.name);

    // Check that death cause was recorded with bot name
    expect(localPlayer.deathCause).toBe(
      'colliding with Crimson Falcon. Maybe try dodging next time?'
    );
  });
});
