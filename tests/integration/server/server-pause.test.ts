import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketServer } from 'ws';
import { GameEngine } from '../../../server/core/GameEngine';

describe('Server pause functionality', () => {
  let wss: WebSocketServer;
  let gameEngine: GameEngine;


  beforeAll(async () => {
    // Create a test server
    wss = new WebSocketServer({ port: 0 });

    
    // Create game engine
    gameEngine = new GameEngine();
    gameEngine.startGameLoop();
  });

  afterAll(async () => {
    gameEngine.stopGameLoop();
    wss.close();
  });

  it('should pause game when no players are present', () => {
    // Initially no players, game should be paused
    gameEngine.updatePauseState();
    expect(gameEngine.isGamePaused()).toBe(true);
  });

  it('should create and preserve asteroids when game is paused', () => {
    // Create asteroids
    const asteroids = gameEngine.createAsteroids(5);
    expect(asteroids.length).toBe(20); // DEBUG.ROIDS.INITIAL_COUNT overrides the requested count
    expect(gameEngine.getAsteroidCount()).toBe(20);
    
    // Game should still be paused (no players)
    gameEngine.updatePauseState();
    expect(gameEngine.isGamePaused()).toBe(true);
    
    // Asteroids should persist
    expect(gameEngine.getAsteroidCount()).toBe(20);
  });

  it('should resume game when players join', () => {
    // Simulate adding a player
    const mockWs = {} as any;
    const player = gameEngine.addPlayer('test-player', 'TestPlayer', mockWs);
    
    expect(player).toBeDefined();
    expect(gameEngine.isGamePaused()).toBe(false);
    
    // Asteroids should still exist
    expect(gameEngine.getAsteroidCount()).toBe(20);
  });

  it('should pause game when all players leave', () => {
    // Remove the player
    const removedPlayer = gameEngine.removePlayer('test-player');
    
    expect(removedPlayer).toBeDefined();
    expect(gameEngine.isGamePaused()).toBe(true);
    
    // Asteroids should still exist
    expect(gameEngine.getAsteroidCount()).toBe(20);
  });

  it('should return existing asteroids when requested again', () => {
    // Request asteroids again - should return existing ones
    const asteroids = gameEngine.createAsteroids(10);
    
    // Should return existing asteroids, not create new ones
    expect(asteroids.length).toBe(20);
    expect(gameEngine.getAsteroidCount()).toBe(20);
  });
});
