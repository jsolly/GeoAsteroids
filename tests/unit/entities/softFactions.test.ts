import { expect, test } from 'vitest';
import {
  canDealCombatDamage,
  parseSoftFactionId,
  SOFT_FACTION_NAMES,
} from '../../../src/entities/player/softFactions';

test('unassigned sides still allow hits so current play keeps working', () => {
  expect(canDealCombatDamage(undefined, undefined)).toBe(true);
  expect(canDealCombatDamage('ion', undefined)).toBe(true);
  expect(canDealCombatDamage(undefined, 'ember')).toBe(true);
});

test('same-side combat is ignored once both ships have a side', () => {
  expect(canDealCombatDamage('ion', 'ion')).toBe(false);
  expect(canDealCombatDamage('ember', 'ember')).toBe(false);
});

test('opposite sides still deal damage', () => {
  expect(canDealCombatDamage('ion', 'ember')).toBe(true);
  expect(canDealCombatDamage('ember', 'ion')).toBe(true);
});

test('soft-faction display names stay ION and EMBER', () => {
  expect(SOFT_FACTION_NAMES.ion).toBe('ION');
  expect(SOFT_FACTION_NAMES.ember).toBe('EMBER');
});

test('parseSoftFactionId ignores unknown marks', () => {
  expect(parseSoftFactionId('ion')).toBe('ion');
  expect(parseSoftFactionId('ember')).toBe('ember');
  expect(parseSoftFactionId('gold')).toBeUndefined();
});
