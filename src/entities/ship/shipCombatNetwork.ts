import type { Laser } from '../laser/Laser';

export interface ShipCombatNetwork {
  readonly isConnected: boolean;
  sendShoot(laser: Laser): void;
  sendAbility(): boolean;
}
