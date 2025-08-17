import {
  BOT_HEALTH_REGEN_DELAY,
  BOT_HEALTH_REGEN_RATE,
  BOT_MAX_HEALTH,
  FPS,
  SHIP_EXPLODE_DUR,
  SHIP_INV_BLINK_DUR,
  SHIP_INV_DUR,
} from '../../constants';
import { Vector } from '../../physics/Vector';
import type { BotPlayer } from './types';

export class BotState {
  public updateBotInvincibility(bot: BotPlayer): void {
    if (bot.ship.blinkCount > 0) {
      // Bot is invincible, update blinking
      bot.ship.spawnProtectionTimer--;
      if (bot.ship.spawnProtectionTimer <= 0) {
        bot.ship.blinkCount--;
        bot.ship.spawnProtectionTimer = this.getBlinkTime();
        bot.ship.blinkOn = !bot.ship.blinkOn; // Toggle blinking state
      }

      // Debug logging for invincibility state
      if (Math.random() < 0.1) {
        console.debug('BOT_INVINCIBILITY', 'Bot invincibility update', {
          botId: bot.id,
          botName: bot.name,
          blinkCount: bot.ship.blinkCount,
          spawnProtectionTimer: bot.ship.spawnProtectionTimer,
          blinkOn: bot.ship.blinkOn,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
          isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        });
      }
    }

    // Ensure invincibility lasts at least until spawnProtectedUntil
    if (typeof bot.spawnProtectedUntil === 'number' && Date.now() < bot.spawnProtectedUntil) {
      // Keep blinkCount non-zero so collision checks that rely on it continue to skip
      if (bot.ship.blinkCount <= 0) {
        bot.ship.blinkCount = 1;
        bot.ship.spawnProtectionTimer = this.getBlinkTime();
        bot.ship.blinkOn = true; // Start visible
        console.debug('BOT_INVINCIBILITY', 'Extended bot invincibility', {
          botId: bot.id,
          botName: bot.name,
          blinkCount: bot.ship.blinkCount,
          spawnProtectionTimer: bot.ship.spawnProtectionTimer,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          currentTime: Date.now(),
        });
      }
    }
  }

  public updateBotHealth(bot: BotPlayer): void {
    if (bot.ship.exploding) {
      return;
    }

    // Update health regeneration timer
    if (bot.ship.lastDamageTime > 0) {
      bot.ship.lastDamageTime--;
    }

    // Start health regeneration after delay
    if (bot.ship.lastDamageTime <= 0 && bot.ship.health < bot.ship.maxHealth) {
      if (bot.ship.healthRegenTimer <= 0) {
        // Heal the bot
        const oldHealth = bot.ship.health;
        bot.ship.health = Math.min(
          bot.ship.health + BOT_HEALTH_REGEN_RATE / FPS,
          bot.ship.maxHealth
        );

        if (bot.ship.health > oldHealth) {
          console.info('BOT_HEAL', 'Bot healed!', {
            botId: bot.id,
            botName: bot.name,
            healAmount: bot.ship.health - oldHealth,
            newHealth: bot.ship.health,
            maxHealth: bot.ship.maxHealth,
          });
        }
      } else {
        bot.ship.healthRegenTimer--;
      }
    }
  }

  public updateBotExplosions(bots: Map<string, BotPlayer>): void {
    for (const [botId, bot] of bots.entries()) {
      if (bot.ship.exploding && bot.ship.explodeTime > 0) {
        bot.ship.explodeTime--;

        // When explosion finishes, check if bot should respawn
        if (bot.ship.explodeTime === 0) {
          if (bot.lives > 0) {
            // Bot still has lives, start respawn timer
            console.info(
              'BOT_EXPLOSION_COMPLETE',
              'Bot explosion finished, starting respawn timer',
              {
                botId,
                name: bot.name,
                botType: bot.botType,
                remainingLives: bot.lives,
              }
            );

            // Start respawn timer (5 seconds at 60 FPS = 300 frames)
            bot.respawnTimer = 300;
            bot.ship.exploding = false;

            // Store respawn position (same as original position for now)
            bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
          } else {
            // Bot has no lives left, mark as permanently dead
            console.info('BOT_EXPLOSION_COMPLETE', 'Bot explosion finished, bot permanently dead', {
              botId,
              name: bot.name,
              botType: bot.botType,
              lives: bot.lives,
            });

            bot.ship.exploding = false;
            // Bot is permanently dead (no more lives)
          }
        }
      }

      // Handle respawn timer
      if (bot.respawnTimer !== undefined && bot.respawnTimer > 0) {
        bot.respawnTimer--;

        if (bot.respawnTimer === 0) {
          // Respawn the bot
          this.respawnBot(botId, bots);
        }
      }
    }
  }

  public handleBotExplosion(botId: string, bots: Map<string, BotPlayer>): void {
    const bot = bots.get(botId);
    if (!bot) {
      return;
    }

    // Set explosion state
    bot.ship.exploding = true;
    bot.ship.explodeTime = 60; // 1 second at 60 FPS

    console.info('BOT_STATE', 'Bot explosion started', {
      botId,
      name: bot.name,
      botType: bot.botType,
    });
  }

  public empDestroyBot(botId: string, bots: Map<string, BotPlayer>): void {
    const bot = bots.get(botId);
    if (!bot) {
      console.info('BOT_EMP', 'Bot not found for EMP destruction', { botId });
      return;
    }

    console.info('BOT_EMP', 'Bot destroyed by EMP, starting explosion and respawn', {
      botId,
      name: bot.name,
      botType: bot.botType,
    });

    // Start explosion sequence (same as laser hit)
    bot.ship.exploding = true;
    bot.ship.explodeTime = 60; // 1 second explosion duration

    console.info('BOT_EMP', 'Bot explosion started for EMP destruction', {
      botId,
    });
  }

  public botTakeDamage(bot: BotPlayer, amount: number): void {
    if (bot.ship.exploding) {
      console.debug('BOT_DAMAGE_SKIP', 'Bot damage skipped - already exploding', {
        botId: bot.id,
        botName: bot.name,
        exploding: bot.ship.exploding,
      });
      return;
    }

    // Log the damage event
    console.info('BOT_DAMAGE', 'Bot took damage!', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      damage: amount,
      previousHealth: bot.ship.health,
      lives: bot.lives,
      position: { x: bot.ship.position.x, y: bot.ship.position.y },
      blinkCount: bot.ship.blinkCount,
      spawnProtectedUntil: bot.spawnProtectedUntil,
      isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
    });

    bot.ship.health -= amount;
    bot.ship.lastDamageTime = FPS;
    bot.ship.healthRegenTimer = Math.ceil(BOT_HEALTH_REGEN_DELAY * FPS);

    console.info('BOT_DAMAGE', 'Bot took damage!', {
      botId: bot.id,
      botName: bot.name,
      botType: bot.botType,
      damage: amount,
      remainingHealth: bot.ship.health,
      lives: bot.lives,
      position: { x: bot.ship.position.x, y: bot.ship.position.y },
    });

    if (bot.ship.health <= 0) {
      bot.ship.health = 0;

      // Bot lost all health, lose a life
      bot.lives--;

      console.info('BOT_LIFE_LOST', 'Bot lost a life due to health reaching 0!', {
        botId: bot.id,
        botName: bot.name,
        botType: bot.botType,
        previousLives: bot.lives + 1,
        remainingLives: bot.lives,
        position: { x: bot.ship.position.x, y: bot.ship.position.y },
        blinkCount: bot.ship.blinkCount,
        spawnProtectedUntil: bot.spawnProtectedUntil,
        isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
      });

      if (bot.lives <= 0) {
        // Bot is dead, mark as exploding and explode
        bot.ship.exploding = true;
        bot.ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
        bot.ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);

        console.error('BOT_DEATH_FINAL', 'Bot died - no lives remaining', {
          botId: bot.id,
          botName: bot.name,
          botType: bot.botType,
          position: { x: bot.ship.position.x, y: bot.ship.position.y },
          blinkCount: bot.ship.blinkCount,
          spawnProtectedUntil: bot.spawnProtectedUntil,
          isInvincible: bot.ship.blinkCount > 0 || bot.spawnProtectedUntil > Date.now(),
        });
      } else {
        // Bot still has lives, start explosion and respawn sequence
        bot.ship.exploding = true;
        bot.ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
        bot.ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);

        console.info('BOT_LIFE_LOST', 'Bot lost a life!', {
          botId: bot.id,
          botName: bot.name,
          botType: bot.botType,
          remainingLives: bot.lives,
        });

        // Start respawn timer
        bot.respawnTimer = 300; // 5 seconds at 60 FPS
        // Store respawn position (same as original position for now)
        bot.respawnPosition = new Vector(bot.ship.position.x, bot.ship.position.y);
      }
    }
  }

  private respawnBot(botId: string, bots: Map<string, BotPlayer>): void {
    const bot = bots.get(botId);
    if (!bot || !bot.respawnPosition) {
      return;
    }

    console.info('BOT_STATE', 'Respawn timer finished, respawning bot', {
      botId,
      name: bot.name,
      botType: bot.botType,
      respawnPosition: { x: bot.respawnPosition.x, y: bot.respawnPosition.y },
    });

    // Reset bot properties for respawn
    bot.ship.exploding = false;
    bot.ship.explodeTime = 0;
    bot.respawnTimer = undefined;
    bot.ship.position = bot.respawnPosition;
    // Don't reset lives - preserve the remaining lives
    bot.score = Math.floor(Math.random() * 2000);
    bot.behaviorState = 'hunting';
    bot.lastBehaviorChange = Date.now();
    bot.ship.a = 0;
    bot.ship.velocity = new Vector(0, 0);
    bot.ship.blinkOn = true;
    bot.ship.blinkCount = Math.ceil(SHIP_INV_DUR / SHIP_INV_BLINK_DUR);
    bot.ship.spawnProtectionTimer = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
    bot.spawnProtectedUntil = Date.now() + SHIP_INV_DUR * 1000;

    // Reset health to full
    bot.ship.health = BOT_MAX_HEALTH;
    bot.ship.lastDamageTime = 0;
    bot.ship.healthRegenTimer = 0;
    bot.ship.thrusterActive = false;
    bot.ship.lastShotTime = 0;

    console.info('BOT_STATE', 'Bot respawned', {
      botId,
      name: bot.name,
      botType: bot.botType,
      position: { x: bot.ship.position.x, y: bot.ship.position.y },
    });
  }

  private getBlinkTime(): number {
    return Math.ceil(SHIP_INV_BLINK_DUR * FPS);
  }
}
