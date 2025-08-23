export interface BotShoot {
  botId: string;
  laserStart: { x: number; y: number };
  laserDirection: { x: number; y: number };
  targetPlayerId: string;
}
