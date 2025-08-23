import type { Player, Position, Velocity } from '../player/types';

export interface BotPlayer extends Player {
  isBot: true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;
  takeDamage(amount: number): void;
}

export interface BotShoot {
  botId: string;
  laserStart: Position;
  laserDirection: Velocity;
  targetPlayerId: string;
}
