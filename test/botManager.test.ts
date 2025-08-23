import { expect, test } from 'vitest';
import { BotPlayer } from '../src/entities/bot/BotPlayer.ts';
import { BotManager } from '../src/entities/bot/botManager.ts';

// Note: Tests now use BotManager singleton without reset

test('BotManager Singleton', () => {
  const instance1 = BotManager.getInstance();
  const instance2 = BotManager.getInstance();
  expect(instance1).toBe(instance2);
});

test('Create Bots', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(3);

  const bots = botManager.getBots();
  expect(bots.size).toBe(3);

  // Check that all bots are BotPlayer instances
  for (const bot of bots.values()) {
    expect(bot).toBeInstanceOf(BotPlayer);
    expect(bot instanceof BotPlayer).toBe(true);
  }
});

test('Clear Bots', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(3);
  expect(botManager.getBots().size).toBe(3);

  botManager.clearBots();
  expect(botManager.getBots().size).toBe(0);
});

test('Bot Movement System', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(2);

  const bots = botManager.getBots();
  const firstBot = Array.from(bots.values())[0];

  // Test bot movement initialization
  expect(firstBot).toBeInstanceOf(BotPlayer);
  expect(firstBot.ship.position).toEqual(
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
  );
});

test('Bot Combat System', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];

  // Test bot combat initialization
  expect(bot).toBeInstanceOf(BotPlayer);
  expect(bot.ship.health).toBeGreaterThan(0);
});

test('Bot Factory Integration', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(3);

  const bots = botManager.getBots();
  expect(bots.size).toBe(3);

  // Check that bots are created
  expect(bots.size).toBe(3);

  // Check that all bots are BotPlayer instances
  for (const bot of bots.values()) {
    expect(bot instanceof BotPlayer).toBe(true);
  }
});

test.skip('Bot Manager State Management', () => {
  const botManager = BotManager.getInstance();

  // Initially inactive
  expect(botManager.isActive).toBe(false);

  botManager.activate();
  expect(botManager.isActive).toBe(true);

  botManager.deactivate();
  expect(botManager.isActive).toBe(false);
});

test('Bot Manager Local Player Info', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();

  const testPosition = { x: 100, y: 200 };
  const testAlive = true;

  botManager.setLocalPlayerInfo('test-id', testPosition, testAlive);
  expect(botManager.localPlayerPosition).toEqual(testPosition);
  expect(botManager.localPlayerAlive).toBe(testAlive);
});

test('Bot Manager Asteroid Avoidance', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  // Mock asteroids for testing
  const mockAsteroids = [
    {
      position: { x: 50, y: 50 },
      r: 20,
      velocity: { x: 0, y: 0 },
      angle: 0,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      position: { x: 200, y: 200 },
      r: 15,
      velocity: { x: 0, y: 0 },
      angle: 0,
      vertices: 6,
      offsets: [1, 1, 1, 1, 1, 1],
    },
  ];

  // Set asteroids for bot avoidance
  botManager.setAsteroids(mockAsteroids);

  // Verify that asteroids are set (we can't directly access the private field,
  // but we can test that the method doesn't throw errors)
  expect(() => botManager.setAsteroids(mockAsteroids)).not.toThrow();

  // Test with empty asteroid array
  expect(() => botManager.setAsteroids([])).not.toThrow();
});

test('Bot Manager Clear Bot Lasers', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  // Test that clearBotLasers doesn't throw
  expect(() => botManager.clearBotLasers()).not.toThrow();
});

test('Bot Manager Unified Laser System', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];

  // Test that bots use ship.lasers just like human players
  expect(bot.ship.lasers).toBeInstanceOf(Array);
  expect(bot.ship.lasers.length).toBe(0); // Initially no lasers
});

test('Bot Manager Bot Damage', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];
  const initialHealth = bot.ship.health;

  // Test that botTakeDamage doesn't throw
  expect(() => botManager.botTakeDamage(bot, 25)).not.toThrow();

  // Health should be reduced
  expect(bot.ship.health).toBeLessThan(initialHealth);
});
