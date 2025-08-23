import type { Player } from '../player/Player';

export interface BotPlayer extends Player {
  isBot: true;
  botType: 'aggressive' | 'defensive' | 'patrol';
}

export interface BotShoot {
  botId: string;
  laserStart: { x: number; y: number };
  laserDirection: { x: number; y: number };
  targetPlayerId: string;
}
