import { expect, test } from 'vitest';

import { PALETTE } from '../../../src/constants';
import {
  areAllied,
  areHostile,
  canApplyCombatDamage,
  countFactions,
  FACTION_COLORS,
  isEnvironmentAttacker,
  pickBalancedFaction,
} from '../../../shared/factions';

test('team colors reuse the locked mint and amber swatches', () => {
  expect(FACTION_COLORS.ion).toBe(PALETTE.LOCAL);
  expect(FACTION_COLORS.ember).toBe(PALETTE.BOT);
});

test('auto-balance fills the smaller faction and ties go to ion', () => {
  expect(pickBalancedFaction([])).toBe('ion');
  expect(pickBalancedFaction(['ion'])).toBe('ember');
  expect(pickBalancedFaction(['ember'])).toBe('ion');
  expect(pickBalancedFaction(['ion', 'ember'])).toBe('ion');
  expect(pickBalancedFaction(['ion', 'ion', 'ember'])).toBe('ember');
});

test('countFactions ignores unset sides', () => {
  expect(countFactions([undefined, 'ion', 'ember', 'ion'])).toEqual({ ion: 2, ember: 1 });
});

test('same-side ships are allied; opposite and unknown are hostile', () => {
  expect(areAllied('ion', 'ion')).toBe(true);
  expect(areAllied('ember', 'ion')).toBe(false);
  expect(areAllied('ion', undefined)).toBe(false);
  expect(areHostile('ion', 'ember')).toBe(true);
  expect(areHostile(undefined, 'ember')).toBe(true);
});

test('environment hits always apply; same-faction ship fire does not', () => {
  expect(isEnvironmentAttacker('asteroid')).toBe(true);
  expect(isEnvironmentAttacker('boundary')).toBe(true);
  expect(canApplyCombatDamage('asteroid', 'ion', 'ion')).toBe(true);
  expect(canApplyCombatDamage('boundary', 'ember', 'ember')).toBe(true);
  expect(canApplyCombatDamage('pilot-1', 'ion', 'ion')).toBe(false);
  expect(canApplyCombatDamage('pilot-1', 'ion', 'ember')).toBe(true);
  expect(canApplyCombatDamage('pilot-1', undefined, 'ember')).toBe(true);
});
