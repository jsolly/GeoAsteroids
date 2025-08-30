import { expect, test } from 'vitest';
import { BotManager } from '../src/entities/bot/botManager';
import { Player } from '../src/entities/player/Player';

// Note: Tests now use BotManager singleton without reset

test('BotManager Singleton', () => {
  const instance1 = BotManager.getInstance();
  const instance2 = BotManager.getInstance();
  expect(instance1).toBe(instance2);
});

test('Create Bots', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(3);

  const bots = botManager.getBots();
  expect(bots.size).toBe(3);

  // Check that all bots are Player instances with type 'bot'
  for (const bot of bots.values()) {
    expect(bot).toBeInstanceOf(Player);
    expect(bot.type).toBe('bot');
  }
});

test('Bot Movement System', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(2);

  const bots = botManager.getBots();
  const firstBot = Array.from(bots.values())[0];

  // Test bot movement initialization
  expect(firstBot).toBeInstanceOf(Player);
  expect(firstBot.type).toBe('bot');
  expect(firstBot.ship.position).toEqual(
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
  );
});

test('Bot Combat System', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];

  // Test bot combat initialization
  expect(bot).toBeInstanceOf(Player);
  expect(bot.type).toBe('bot');
  expect(bot.ship.health).toBeGreaterThan(0);
});

test('Bot Factory Integration', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(3);

  const bots = botManager.getBots();
  expect(bots.size).toBe(3);

  // Check that all bots are Player instances with type 'bot'
  for (const bot of bots.values()) {
    expect(bot).toBeInstanceOf(Player);
    expect(bot.type).toBe('bot');
  }
});

test('Bot Manager Local Player Info', () => {
  const botManager = BotManager.getInstance();

  const testPosition = { x: 100, y: 200 };
  const testAlive = true;

  botManager.setLocalPlayerInfo('test-id', testPosition, testAlive);
  expect(botManager.localPlayerPosition).toEqual(testPosition);
  expect(botManager.localPlayerAlive).toBe(testAlive);
});

test('Bot Manager Roid Avoidance', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(1);

  // Mock roids for testing
  const mockRoids = [
    {
      id: 'roid_1',
      position: { x: 50, y: 50 },
      r: 20,
      velocity: { x: 0, y: 0 },
      angle: 0,
      angularVelocity: 0,
      vertices: 8,
      offsets: [1, 1, 1, 1, 1, 1, 1, 1],
      health: 200,
      maxHealth: 200,
      jaggedness: 0.4,
    },
    {
      id: 'roid_2',
      position: { x: 200, y: 200 },
      r: 15,
      velocity: { x: 0, y: 0 },
      angle: 0,
      angularVelocity: 0,
      vertices: 6,
      offsets: [1, 1, 1, 1, 1, 1],
      health: 150,
      maxHealth: 150,
      jaggedness: 0.4,
    },
  ];

  // Set roids for bot avoidance
  botManager.setRoids(mockRoids);

  // Verify that roids are set (we can't directly access the private field,
  // but we can test that the method doesn't throw errors)
  expect(() => botManager.setRoids(mockRoids)).not.toThrow();

  // Test with empty roid array
  expect(() => botManager.setRoids([])).not.toThrow();
});

test('Bot Manager Unified Laser System', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];

  // Test that bots use ship.lasers just like human players
  expect(bot.ship.lasers).toBeInstanceOf(Array);
  expect(bot.ship.lasers.length).toBe(0); // Initially no lasers
});

test('Bot Manager Bot Damage', () => {
  const botManager = BotManager.getInstance();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const bot = Array.from(bots.values())[0];
  const initialHealth = bot.ship.health;

  // Test that bot damage system works through the unified Player system
  expect(() => bot.ship.takeDamage(25)).not.toThrow();

  // Health should be reduced
  expect(bot.ship.health).toBeLessThan(initialHealth);
});
