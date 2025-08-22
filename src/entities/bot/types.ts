import type { Vector } from '../../physics/Vector';
import type { Player } from '../player/types';

export interface BotPlayer extends Player {
  isBot: true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;
  takeDamage(amount: number): void;
}

export interface BotShoot {
  botId: string;
  laserStart: Vector;
  laserDirection: Vector;
  targetPlayerId: string;
}
