import { FPS, SHIP_EXPLODE_DUR_FRAMES, SHIP_HEALTH_REGEN_DELAY } from '../../constants';
import { Player } from '../player/Player';
import type { BotPlayer as BotPlayerInterface } from './types';

export class BotPlayer extends Player implements BotPlayerInterface {
  isBot: true = true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;

  constructor(id: string, name: string, botType: 'aggressive' | 'defensive' | 'patrol') {
    super({ id, name, isBot: true });
    this.botType = botType;
    this.behaviorState = 'hunting'; // Start attacking immediately
    this.lastBehaviorChange = Date.now();
    this.ship.lastShotTime = 0;
    this.ship.lastRotation = 0;
  }

  // Override ship's takeDamage to handle bot-specific explosion behavior
  takeDamage(amount: number): void {
    // Early exit if already exploding or dead
    if (this.ship.exploding || this.ship.health <= 0) {
      return;
    }

    console.debug('BOT_DAMAGE_DEBUG', 'Bot taking damage', {
      botId: this.id,
      botType: this.botType,
      damageAmount: amount,
      healthBefore: this.ship.health,
      maxHealth: this.ship.maxHealth,
    });

    // Use ship's standard damage calculation and timers
    this.ship.health -= amount;
    this.ship.lastDamageTime = Date.now(); // Use timestamp instead of frame count
    this.ship.healthRegenTimer = Math.ceil(SHIP_HEALTH_REGEN_DELAY * FPS); // Convert to frames

    console.debug('BOT_DAMAGE_DEBUG', 'Damage applied to bot ship', {
      botId: this.id,
      healthAfter: this.ship.health,
      lastDamageTime: this.ship.lastDamageTime,
      healthRegenTimer: this.ship.healthRegenTimer,
    });

    if (this.ship.health <= 0) {
      console.debug('BOT_DAMAGE_DEBUG', 'Bot health reached 0, setting exploding state', {
        botId: this.id,
        finalHealth: this.ship.health,
      });

      this.ship.health = 0;
      // Trigger explosion without affecting lives (unlike ship behavior)
      this.ship.exploding = true;
      this.ship.explodeTime = SHIP_EXPLODE_DUR_FRAMES;
    }
  }
}
