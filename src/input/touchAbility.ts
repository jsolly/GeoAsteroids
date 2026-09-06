import { FUEL } from '../constants';
import {
  getShipKit,
  SHIP_ABILITY,
  type ShipAbilityId,
  type ShipKitId,
} from '../entities/ship/shipKits';

const ABILITY_LABEL: Record<ShipAbilityId, string> = {
  boostDash: 'DASH',
  harpoon: 'HOOK',
  shieldFocus: 'SHIELD',
  burstFire: 'BURST',
  shockPulse: 'PULSE',
};

export type AbilityChromeHost = {
  kitId: ShipKitId | string;
  exploding: boolean;
  health: number;
  abilityCooldownFrames: number;
  abilityActiveFrames: number;
  fuel?: number;
};

export type AbilityChromeState = {
  label: string;
  name: string;
  ready: boolean;
  active: boolean;
  cooldownRatio: number;
};

/** Short phosphor label for the on-screen kit button. */
export function touchAbilityLabel(kitId: unknown): string {
  return ABILITY_LABEL[getShipKit(kitId).abilityId];
}

export function touchAbilityName(kitId: unknown): string {
  return getShipKit(kitId).abilityName;
}

export function abilityCooldownRatio(
  kitId: unknown,
  cooldownFrames: number,
  maxFrames: number = SHIP_ABILITY.COOLDOWN_FRAMES[getShipKit(kitId).id]
): number {
  if (maxFrames <= 0 || cooldownFrames <= 0) {
    return 0;
  }
  return Math.min(1, cooldownFrames / maxFrames);
}

export function canAffordTouchAbility(host: AbilityChromeHost): boolean {
  const kit = getShipKit(host.kitId);
  if (kit.abilityId !== 'shockPulse') {
    return true;
  }
  if (host.fuel === undefined) {
    return true;
  }
  return host.fuel >= FUEL.EMP_COST;
}

export function readAbilityChrome(host: AbilityChromeHost): AbilityChromeState {
  const kit = getShipKit(host.kitId);
  const ready =
    !host.exploding &&
    host.health > 0 &&
    host.abilityCooldownFrames <= 0 &&
    canAffordTouchAbility(host);
  return {
    label: ABILITY_LABEL[kit.abilityId],
    name: kit.abilityName,
    ready,
    active: host.abilityActiveFrames > 0,
    cooldownRatio: abilityCooldownRatio(kit.id, host.abilityCooldownFrames),
  };
}
