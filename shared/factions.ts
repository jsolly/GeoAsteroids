import type { FactionId } from '../shared-types';

export const FACTION_IDS = ['ion', 'ember'] as const;

/** Locked playfield hexes — ion mint, ember amber. */
export const FACTION_COLORS: Record<FactionId, string> = {
  ion: '#5EEAD4',
  ember: '#FB923C',
};

export const FACTION_LABELS: Record<FactionId, string> = {
  ion: 'ION',
  ember: 'EMBER',
};

export function isFactionId(value: unknown): value is FactionId {
  return value === 'ion' || value === 'ember';
}

export function getTeamColor(faction: FactionId): string {
  return FACTION_COLORS[faction];
}

export function countFactions(
  factions: readonly (FactionId | undefined)[]
): Record<FactionId, number> {
  const counts: Record<FactionId, number> = { ion: 0, ember: 0 };
  for (const faction of factions) {
    if (faction === 'ion' || faction === 'ember') {
      counts[faction] += 1;
    }
  }
  return counts;
}

/** Assign the smaller side. Ties fill ion first so the next join lands on ember. */
export function pickBalancedFaction(existing: readonly (FactionId | undefined)[]): FactionId {
  const { ion, ember } = countFactions(existing);
  if (ion < ember) {
    return 'ion';
  }
  if (ember < ion) {
    return 'ember';
  }
  return 'ion';
}

export function areAllied(a: FactionId | undefined, b: FactionId | undefined): boolean {
  return a !== undefined && b !== undefined && a === b;
}

export function areHostile(a: FactionId | undefined, b: FactionId | undefined): boolean {
  return !areAllied(a, b);
}

export function isEnvironmentAttacker(attackerId: string): boolean {
  return attackerId === 'asteroid' || attackerId === 'boundary';
}

/** Environment always hits. Same-faction ships never do. Unknown attacker stays hostile. */
export function canApplyCombatDamage(
  attackerId: string,
  attackerFaction: FactionId | undefined,
  targetFaction: FactionId | undefined
): boolean {
  if (isEnvironmentAttacker(attackerId)) {
    return true;
  }
  return areHostile(attackerFaction, targetFaction);
}
