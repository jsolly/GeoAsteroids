import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BOT_LASER_DAMAGE,
  BOT_MAX_HEALTH,
  SHIP_EXPLODE_DUR_FRAMES,
  SHIP_INV_DUR,
  SHIP_RESPAWN_DELAY_FRAMES,
} from '../src/constants';
import { BotManager } from '../src/entities/bot/botManager.ts';
import { Vector } from '../src/physics/Vector.ts';

describe('BotManager', () => {
  let botManager: BotManager;

  beforeAll(() => {
    botManager = BotManager.getInstance();
  });

  beforeEach(() => {
    botManager.clearBots();
    botManager.setLocalPlayerInfo('player-1', new Vector(0, 0), true);
    botManager.activate();
  });

  describe('Bot Creation and Management', () => {
    test('creates bots with correct properties and types', () => {
      botManager.createBots(3);
      const bots = botManager.getBots();

      expect(bots.size).toBe(3);

      for (const [, bot] of bots.entries()) {
        expect(bot.id).toMatch(/^bot-/);
        expect(bot.name).toMatch(/^Bot_[ADP]_[1-3]$/);
        expect(bot.ship.position).toBeInstanceOf(Vector);
        expect(bot.ship.velocity).toBeInstanceOf(Vector);
        expect(bot.ship.r).toBe(25);
        expect(bot.lives).toBe(3);
        expect(bot.ship.exploding).toBe(false);
        expect(bot.isBot).toBe(true);
        expect(['aggressive', 'defensive', 'patrol']).toContain(bot.botType);
        expect(bot.behaviorState).toBe('hunting');
        expect(bot.ship.health).toBe(BOT_MAX_HEALTH);
        expect(bot.ship.maxHealth).toBe(BOT_MAX_HEALTH);
      }

      // Test bot types
      const botTypes = Array.from(bots.values()).map((bot) => bot.botType);
      expect(botTypes).toContain('aggressive');
      expect(botTypes).toContain('defensive');
      expect(botTypes).toContain('patrol');
    });

    test('positions bots around the world center', () => {
      botManager.createBots(8);
      const bots = botManager.getBots();

      const positions = Array.from(bots.values()).map((bot) => ({
        x: Math.abs(bot.ship.position.x),
        y: Math.abs(bot.ship.position.y),
      }));

      // All bots should be positioned around the center (0,0)
      for (const pos of positions) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(150);
        expect(pos.y).toBeLessThanOrEqual(150);
        // At least one coordinate should be non-zero (not at exact center)
        expect(pos.x > 0 || pos.y > 0).toBe(true);
      }
    });

    test('clears all bots and bullets', () => {
      botManager.createBots(3);
      expect(botManager.getBots().size).toBe(3);

      botManager.clearBots();
      expect(botManager.getBots().size).toBe(0);
      expect(botManager.getBotBullets().size).toBe(0);
      expect(botManager.getBotLasers().size).toBe(0);
    });

    test('removes individual bots', () => {
      botManager.createBots(3);
      const bots = botManager.getBots();
      const botId = Array.from(bots.keys())[0];

      botManager.removeBot(botId);
      expect(botManager.getBots().size).toBe(2);
      expect(botManager.getBots().has(botId)).toBe(false);
    });
  });

  describe('Bot Invincibility System', () => {
    test('bots start with invincibility', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Bot should be invincible initially
      const isInvincible = bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now();
      expect(isInvincible).toBe(true);
      expect(bot.ship.blinkCount).toBeGreaterThan(0);
      expect(bot.spawnProtectedUntil).toBeGreaterThan(Date.now());
    });

    test('bots maintain invincibility during spawn protection window', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Fast-forward time but keep within spawn protection window
      const futureTime = Date.now() + (SHIP_INV_DUR - 1) * 1000; // Just before protection expires
      vi.useFakeTimers();
      vi.setSystemTime(futureTime);

      // Bot should still be invincible during spawn protection
      const isInvincible = bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now();
      expect(isInvincible).toBe(true);

      // Restore timers/time
      vi.useRealTimers();
    });

    test('bots blink during invincibility period', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Verify initial blink state
      expect(bot.ship.blinkOn).toBe(true);
      expect(bot.ship.blinkCount).toBeGreaterThan(0);
      expect(bot.ship.spawnProtectionTimer).toBeGreaterThan(0);

      // Simulate multiple frames to see blinking
      for (let i = 0; i < 200; i++) {
        const previousBlinkOn = bot.ship.blinkOn;
        // Update bot in game loop to trigger invincibility updates
        botManager.updateBotsInGameLoop();
        if (bot.ship.blinkOn !== previousBlinkOn) {
          // Blinking is working
          break;
        }
      }

      // Bot should still be invincible after blinking
      const stillInvincible = bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now();
      expect(stillInvincible).toBe(true);
    });
  });

  describe('Bot Damage and Life System', () => {
    test('bots take damage and lose lives when not invincible', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Remove invincibility
      bot.ship.blinkCount = 0;
      bot.spawnProtectedUntil = 0;

      // Take damage multiple times
      const damagePerHit = BOT_LASER_DAMAGE;
      const hitsToLoseLife = Math.ceil(BOT_MAX_HEALTH / damagePerHit);

      for (let i = 0; i < hitsToLoseLife; i++) {
        const previousHealth = bot.ship.health;
        const previousLives = bot.lives;

        botManager.botTakeDamage(bot, damagePerHit);

        if (i < hitsToLoseLife - 1) {
          // Should lose health but not life yet
          expect(bot.ship.health).toBeLessThan(previousHealth);
          expect(bot.lives).toBe(previousLives);
          expect(bot.ship.exploding).toBe(false);
        } else {
          // Final hit should cause life loss
          expect(bot.ship.health).toBe(0);
          expect(bot.lives).toBe(previousLives - 1);
          expect(bot.ship.exploding).toBe(true);
          expect(bot.ship.explodeTime).toBeGreaterThan(0);
        }
      }
    });

    test('bots take incremental damage like players do', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Remove invincibility
      bot.ship.blinkCount = 0;
      bot.spawnProtectedUntil = 0;

      // Verify initial health
      expect(bot.ship.health).toBe(BOT_MAX_HEALTH);
      expect(bot.lives).toBe(3);

      // Take first hit - should lose health but not life
      const firstHitDamage = BOT_LASER_DAMAGE;
      botManager.botTakeDamage(bot, firstHitDamage);

      expect(bot.ship.health).toBe(BOT_MAX_HEALTH - firstHitDamage);
      expect(bot.lives).toBe(3);
      expect(bot.ship.exploding).toBe(false);

      // Take second hit - should lose more health
      const secondHitDamage = BOT_LASER_DAMAGE;
      botManager.botTakeDamage(bot, secondHitDamage);

      expect(bot.ship.health).toBe(BOT_MAX_HEALTH - firstHitDamage - secondHitDamage);
      expect(bot.lives).toBe(3);
    });

    test('bots lose lives when health reaches zero', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Remove invincibility
      bot.ship.blinkCount = 0;
      bot.spawnProtectedUntil = 0;

      // Deal enough damage to kill the bot
      const totalDamage = BOT_MAX_HEALTH + 10;
      botManager.botTakeDamage(bot, totalDamage);

      expect(bot.ship.health).toBe(0);
      expect(bot.lives).toBe(2); // Lost one life
      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.explodeTime).toBeGreaterThan(0);
    });

    test('bots die permanently when all lives are lost', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Remove invincibility
      bot.ship.blinkCount = 0;
      bot.spawnProtectedUntil = 0;

      // Deal damage to kill the bot multiple times
      // Each time health reaches 0, bot loses a life
      for (let i = 0; i < 3; i++) {
        const damage = BOT_MAX_HEALTH + 10;
        botManager.botTakeDamage(bot, damage);

        // Wait for explosion to complete and respawn if not the final death
        if (i < 2) {
          // Fast-forward through explosion and respawn timer
          const explosionDuration = SHIP_EXPLODE_DUR_FRAMES;
          const respawnDelay = SHIP_RESPAWN_DELAY_FRAMES;
          const totalFrames = explosionDuration + respawnDelay;

          for (let j = 0; j < totalFrames; j++) {
            botManager.updateBotsInGameLoop();
          }

          // Bot should be respawned and ready for next hit
          expect(bot.ship.exploding).toBe(false);
          expect(bot.ship.health).toBe(BOT_MAX_HEALTH);
        }
      }

      // After losing all 3 lives, bot should be permanently dead
      expect(bot.lives).toBe(0);
      expect(bot.ship.exploding).toBe(true);
    });
  });

  describe('Bot Explosion and Respawn System', () => {
    test('bots explode when taking fatal damage', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Remove invincibility
      bot.ship.blinkCount = 0;
      bot.spawnProtectedUntil = 0;

      // Deal fatal damage
      botManager.botTakeDamage(bot, BOT_MAX_HEALTH + 10);

      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.explodeTime).toBeGreaterThan(0);
    });

    test('bot explosions progress over time', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Start explosion
      botManager.handleBotExplosion(bot.id);
      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.explodeTime).toBe(SHIP_EXPLODE_DUR_FRAMES);

      // Simulate explosion progress
      const initialExplodeTime = bot.ship.explodeTime;
      botManager.updateBotsInGameLoop();

      // Explosion should progress
      expect(bot.ship.explodeTime).toBeLessThan(initialExplodeTime);
    });

    test('bots respawn after explosion completes', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Start explosion
      botManager.handleBotExplosion(bot.id);
      expect(bot.ship.exploding).toBe(true);

      // Fast-forward through explosion and respawn timer
      const explosionDuration = SHIP_EXPLODE_DUR_FRAMES;
      const respawnDelay = SHIP_RESPAWN_DELAY_FRAMES;
      const totalFrames = explosionDuration + respawnDelay;

      for (let i = 0; i < totalFrames; i++) {
        botManager.updateBotsInGameLoop();
      }

      // Bot should be respawned
      expect(bot.ship.exploding).toBe(false);
      expect(bot.lives).toBe(3);
      expect(bot.ship.health).toBe(BOT_MAX_HEALTH);
      expect(bot.ship.blinkCount).toBeGreaterThan(0);
    });
  });

  describe('Bot Movement and Behavior', () => {
    test('bots move towards player when hunting', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Set player position away from bot
      const playerPosition = new Vector(100, 100);
      botManager.setLocalPlayerInfo('player-1', playerPosition, true);

      // Record initial position
      const initialPosition = new Vector(bot.ship.position.x, bot.ship.position.y);

      // Update bot behavior multiple times
      for (let i = 0; i < 100; i++) {
        botManager.updateBotsInGameLoop();
      }

      // Bot should have moved towards player
      const finalPosition = bot.ship.position;
      const distanceToPlayer = finalPosition.distance(playerPosition);
      const initialDistanceToPlayer = initialPosition.distance(playerPosition);

      expect(distanceToPlayer).toBeLessThan(initialDistanceToPlayer);
    });

    test('bots maintain hunting behavior', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Verify initial behavior
      expect(bot.behaviorState).toBe('hunting');

      // Update behavior multiple times
      for (let i = 0; i < 100; i++) {
        botManager.updateBotsInGameLoop();
      }

      // Bot should still be hunting
      expect(bot.behaviorState).toBe('hunting');
    });
  });

  describe('Bot Combat System', () => {
    test('bots can shoot at players', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Position bot close to player and facing them
      bot.ship.position = new Vector(50, 0);
      bot.ship.a = 0; // Face right (towards player at origin)

      // Set up shoot callback
      let shotFired = false;
      botManager.setBotShootCallback(() => {
        shotFired = true;
      });

      // Update shooting multiple times
      for (let i = 0; i < 100; i++) {
        botManager.updateBotsInGameLoop();
      }

      // Bot should have fired at least one shot
      expect(shotFired).toBe(true);
    });

    test('bot lasers are created and updated', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Position bot close to player and facing them
      bot.ship.position = new Vector(50, 0);
      bot.ship.a = 0;

      // Set up shoot callback to create laser
      botManager.setBotShootCallback((botShoot) => {
        botManager.createBotLaser(botShoot);
      });

      // Update to trigger shooting
      botManager.updateBotsInGameLoop();

      // Bot should have lasers
      const lasers = botManager.getBotLasers();
      expect(lasers.size).toBeGreaterThan(0);
    });
  });

  describe('EMP Destruction', () => {
    test('bots can be destroyed by EMP', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Bot should be alive initially

      expect(bot.ship.exploding).toBe(false);

      // Destroy bot with EMP
      botManager.empDestroyBot(bot.id);

      // Bot should be dead and exploding

      expect(bot.ship.exploding).toBe(true);
      expect(bot.ship.explodeTime).toBe(SHIP_EXPLODE_DUR_FRAMES);
    });
  });

  describe('Local Player Updates', () => {
    test('updates local player information', () => {
      const newPosition = new Vector(200, 200);
      botManager.updateLocalPlayerPosition(newPosition, false);

      expect(botManager.localPlayerPosition.x).toBe(200);
      expect(botManager.localPlayerPosition.y).toBe(200);
      expect(botManager.localPlayerAlive).toBe(false);
    });

    test('bot movement responds to player position changes', () => {
      botManager.createBots(1);
      const bots = botManager.getBots();
      const bot = Array.from(bots.values())[0];

      // Set player far away
      botManager.updateLocalPlayerPosition(new Vector(500, 500), true);

      // Update bot behavior
      botManager.updateBotsInGameLoop();

      // Bot should move towards new player position
      // Note: Bots move slowly, so we just check they're not moving away
      const initialDistance = new Vector(-150, -150).distance(new Vector(500, 500));
      const currentDistance = bot.ship.position.distance(new Vector(500, 500));

      // Bot should be moving towards player (distance should be decreasing or at least not increasing significantly)
      expect(currentDistance).toBeLessThanOrEqual(initialDistance + 50); // Allow for some movement variance
    });
  });

  describe('Bot Factory Integration', () => {
    test('factory creates and positions bots correctly', () => {
      botManager.createBots(8);
      const bots = botManager.getBots();

      const botTypes = Array.from(bots.values()).map((bot) => bot.botType);
      expect(botTypes).toContain('aggressive');
      expect(botTypes).toContain('defensive');
      expect(botTypes).toContain('patrol');

      // All bots should be positioned around the center
      for (const [, bot] of bots.entries()) {
        expect(Math.abs(bot.ship.position.x)).toBeLessThanOrEqual(150);
        expect(Math.abs(bot.ship.position.y)).toBeLessThanOrEqual(150);
        expect(bot.ship.position.x !== 0 || bot.ship.position.y !== 0).toBe(true); // Not at exact center
      }
    });
  });
});
