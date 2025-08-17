import { Player } from '../player/Player';
import type { BotPlayer as BotPlayerInterface } from './types';

export class BotPlayer extends Player implements BotPlayerInterface {
  isBot: true = true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;

  constructor(id: string, name: string, botType: 'aggressive' | 'defensive' | 'patrol') {
    super(id, name, 3, true);
    this.botType = botType;
    this.behaviorState = 'hunting';
    this.lastBehaviorChange = Date.now();

    // Initialize ship properties
    this.ship.lastShotTime = 0;
    this.ship.shotCooldown = 500;
    this.ship.thrusterActive = false;
  }
}
