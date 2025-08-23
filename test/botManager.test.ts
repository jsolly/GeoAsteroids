import { beforeEach, expect, test } from 'vitest';
import { BotPlayer } from '../src/entities/bot/BotPlayer.ts';
import { BotManager } from '../src/entities/bot/botManager.ts';

beforeEach(() => {
  // Reset the singleton instance for each test
  BotManager.resetInstance();
});

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
    expect(bot.isBot).toBe(true);
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

test('Remove Specific Bot', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(3);

  const bots = botManager.getBots();
  const botId = Array.from(bots.keys())[0];
  botManager.removeBot(botId);

  expect(botManager.getBots().size).toBe(2);
  expect(botManager.getBots().has(botId)).toBe(false);
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

  // Check bot types
  const botTypes = new Set();
  for (const bot of bots.values()) {
    botTypes.add(bot.botType);
  }

  // Should have at least 2 different bot types
  expect(botTypes.size).toBeGreaterThanOrEqual(2);
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
  botManager.setLocalPlayerInfo('test-player', testPosition, true);

  expect(botManager.localPlayerPosition.x).toBe(100);
  expect(botManager.localPlayerPosition.y).toBe(200);
  expect(botManager.localPlayerAlive).toBe(true);
});

test('Bot Manager Bot Lasers', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(2);

  const botLasers = botManager.getBotLasers();
  expect(botLasers).toBeInstanceOf(Map);

  // Initially no lasers
  expect(botLasers.size).toBe(0);
});

test('Bot Manager Clear Bot Lasers', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  // Add some test lasers
  const botLasers = botManager.getBotLasers();
  const botId = Array.from(botManager.getBots().keys())[0];
  botLasers.set(botId, []);

  expect(botLasers.size).toBe(1);

  botManager.clearBotLasers();
  expect(botLasers.size).toBe(0);
});

test('Bot Manager Update Bot Lasers', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  // Test that update doesn't throw
  expect(() => botManager.updateBotLasers()).not.toThrow();
});

test('Bot Manager Create Bot Laser', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  const botId = Array.from(botManager.getBots().keys())[0];

  // Test that createBotLaser doesn't throw
  expect(() => {
    botManager.createBotLaser({
      botId,
      laserStart: { x: 0, y: 0 },
      laserDirection: { x: 1, y: 0 },
      targetPlayerId: 'test-player',
    });
  }).not.toThrow();
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

test('Bot Manager EMP Destroy Bot', () => {
  const botManager = BotManager.getInstance();
  botManager.activate();
  botManager.createBots(1);

  const bots = botManager.getBots();
  const botId = Array.from(bots.keys())[0];

  // Test that empDestroyBot doesn't throw
  expect(() => botManager.empDestroyBot(botId)).not.toThrow();

  // Bot should be marked as exploding
  const bot = bots.get(botId);
  expect(bot?.ship.exploding).toBe(true);
});
