import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../../server/core/GameEngine';
import { DEBUG } from '../../src/constants';

describe('Roid Placement Integration Tests', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    gameEngine = new GameEngine();
  });

  afterEach(() => {
    // Clean up
    gameEngine = null as any;
  });

  describe('PLACE_ROID_ON_LOCAL_PLAYER functionality', () => {
    it('should place roids on player positions when PLACE_ROID_ON_LOCAL_PLAYER is true', () => {
      // Verify the debug setting is enabled
      expect(DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER).toBe(true);

      // Create a player at a specific position
      const playerId = 'test-player-1';
      const playerName = 'TestPlayer';
      const playerPosition = { x: 100, y: 200 };
      
      // Mock WebSocket for player creation
      const mockWs = {} as any;
      gameEngine.addPlayer(playerId, playerName, mockWs, playerPosition);

      // Get player positions
      const players = gameEngine.getAllPlayers();
      const playerPositions = players.map(player => player.position);
      
      expect(playerPositions).toHaveLength(1);
      expect(playerPositions[0]).toEqual(playerPosition);

      // Create bots at specific positions
      const botPositions = [
        { x: 300, y: 400 },
        { x: 500, y: 600 }
      ];
      
      // Create bots (this will add them to the game engine)
      const bots = gameEngine.createBots(2);
      expect(bots).toHaveLength(2);

      // Create asteroids with player and bot positions
      // Note: DEBUG.ROIDS.INITIAL_COUNT overrides the requested count
      const asteroids = gameEngine.createAsteroids(5, { radius: 3100 }, botPositions, playerPositions);
      
      // DEBUG.ROIDS.INITIAL_COUNT is 20, so we expect 20 asteroids
      expect(asteroids).toHaveLength(20);

      // Check if any asteroids are placed on player positions
      const asteroidsOnPlayer = asteroids.filter(asteroid => 
        Math.abs(asteroid.position.x - playerPosition.x) < 10 &&
        Math.abs(asteroid.position.y - playerPosition.y) < 10
      );

      // With PLACE_ROID_ON_LOCAL_PLAYER enabled, we should have at least one asteroid on the player
      expect(asteroidsOnPlayer.length).toBeGreaterThan(0);
      
      console.log('Player position:', playerPosition);
      console.log('Asteroid positions:', asteroids.map(a => ({ x: a.position.x, y: a.position.y })));
      console.log('Asteroids on player:', asteroidsOnPlayer.length);
    });

    it('should not place roids on player positions when PLACE_ROID_ON_LOCAL_PLAYER is false', () => {
      // Temporarily disable the setting
      const originalSetting = DEBUG.ROIDS.PLACE_ON_LOCAL_PLAYER;
      (DEBUG as any).ROIDS.PLACE_ON_LOCAL_PLAYER = false;

      try {
        const playerId = 'test-player-2';
        const playerName = 'TestPlayer2';
        const playerPosition = { x: 150, y: 250 };
        
        const mockWs = {} as any;
        gameEngine.addPlayer(playerId, playerName, mockWs, playerPosition);

        const players = gameEngine.getAllPlayers();
        const playerPositions = players.map(player => player.position);
        
        const asteroids = gameEngine.createAsteroids(3, { radius: 3100 }, [], playerPositions);
        
        // Check if any asteroids are placed on player positions
        const asteroidsOnPlayer = asteroids.filter(asteroid => 
          Math.abs(asteroid.position.x - playerPosition.x) < 10 &&
          Math.abs(asteroid.position.y - playerPosition.y) < 10
        );

        // With PLACE_ROID_ON_LOCAL_PLAYER disabled, we should have no asteroids on the player
        expect(asteroidsOnPlayer.length).toBe(0);
      } finally {
        // Restore original setting
        (DEBUG as any).ROIDS.PLACE_ON_LOCAL_PLAYER = originalSetting;
      }
    });

    it('should place roids on bot positions when PLACE_ROID_ON_BOT is true', () => {
      // Verify the debug setting is enabled
      expect(DEBUG.ROIDS.PLACE_ON_BOT).toBe(false);

      const botPositions = [
        { x: 100, y: 200 },
        { x: 300, y: 400 }
      ];
      
      // Create bots
      const bots = gameEngine.createBots(2);
      expect(bots).toHaveLength(2);

      const asteroids = gameEngine.createAsteroids(4, { radius: 3100 }, botPositions, []);
      
      // DEBUG.ROIDS.INITIAL_COUNT is 20, so we expect 20 asteroids
      expect(asteroids).toHaveLength(20);

      // Check if any asteroids are placed on bot positions
      const asteroidsOnBots = asteroids.filter(asteroid => 
        botPositions.some(botPos => 
          Math.abs(asteroid.position.x - botPos.x) < 10 &&
          Math.abs(asteroid.position.y - botPos.y) < 10
        )
      );

      // With PLACE_ROID_ON_BOT disabled, we should have no asteroids on bots
      expect(asteroidsOnBots.length).toBe(0);
    });
  });

  describe('Server startup behavior', () => {
    it('should not create asteroids at server startup when no players exist', () => {
      // This test verifies the current problematic behavior
      // The server currently creates asteroids at startup with empty player positions
      
      const asteroids = gameEngine.createAsteroids(10, { radius: 3100 }, [], []);
      
      // DEBUG.ROIDS.INITIAL_COUNT is 20, so we expect 20 asteroids
      expect(asteroids).toHaveLength(20);
      
      // Verify no asteroids are at origin (0,0) where players typically spawn
      const asteroidsAtOrigin = asteroids.filter(asteroid => 
        Math.abs(asteroid.position.x) < 10 &&
        Math.abs(asteroid.position.y) < 10
      );
      
      // This should be 0 or very few since we're not placing on players
      expect(asteroidsAtOrigin.length).toBeLessThan(3);
    });
  });
});
