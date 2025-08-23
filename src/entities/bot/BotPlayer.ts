import { Player } from '../player/Player';
import type { BotPlayer as BotPlayerInterface } from './types';

export class BotPlayer extends Player implements BotPlayerInterface {
  isBot: true = true;
  botType: 'aggressive' | 'defensive' | 'patrol';

  constructor(params: {
    id: string;
    name: string;
    botType?: 'aggressive' | 'defensive' | 'patrol';
  }) {
    super({ id: params.id, name: params.name });
    this.botType = params.botType || 'aggressive';
  }
}
