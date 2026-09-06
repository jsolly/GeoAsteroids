import { expect, test } from 'vitest';

import { Player } from '../../../src/entities/player/Player';
import { DEFAULT_SHIP_KIT_ID, SHIP_ABILITY } from '../../../src/entities/ship/shipKits';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import {
  abilityCooldownRatio,
  canAffordTouchAbility,
  readAbilityChrome,
  touchAbilityLabel,
  touchAbilityName,
} from '../../../src/input/touchAbility';
import { triggerTouchAbility } from '../../../src/input/touchControls';

test('each kit gets a short on-screen ability label', () => {
  expect(touchAbilityLabel('dart')).toBe('DASH');
  expect(touchAbilityLabel('hauler')).toBe('HOOK');
  expect(touchAbilityLabel('warden')).toBe('SHIELD');
  expect(touchAbilityLabel('skirmisher')).toBe('BURST');
  expect(touchAbilityLabel('quake')).toBe('PULSE');
  expect(touchAbilityName('hauler')).toBe('Harpoon');
  expect(touchAbilityLabel('unknown')).toBe(touchAbilityLabel(DEFAULT_SHIP_KIT_ID));
});

test('ability chrome is ready until cooldown or an empty Quake tank', () => {
  const ready = readAbilityChrome({
    kitId: 'dart',
    exploding: false,
    health: 100,
    abilityCooldownFrames: 0,
    abilityActiveFrames: 0,
  });
  expect(ready.ready).toBe(true);
  expect(ready.label).toBe('DASH');
  expect(ready.cooldownRatio).toBe(0);

  const cooling = readAbilityChrome({
    kitId: 'dart',
    exploding: false,
    health: 100,
    abilityCooldownFrames: SHIP_ABILITY.COOLDOWN_FRAMES.dart / 2,
    abilityActiveFrames: 0,
  });
  expect(cooling.ready).toBe(false);
  expect(cooling.cooldownRatio).toBeCloseTo(0.5, 5);

  expect(
    canAffordTouchAbility({
      kitId: 'quake',
      exploding: false,
      health: 100,
      abilityCooldownFrames: 0,
      abilityActiveFrames: 0,
      fuel: 0,
    })
  ).toBe(false);
  expect(abilityCooldownRatio('warden', 0)).toBe(0);
});

test('touch ability button is the same press as KeyE', () => {
  const player = new Player({ id: 'p', name: 'P', type: 'local', input: new MockPlayerInput() });
  expect(triggerTouchAbility(player)).toBe(true);
  expect(player.ship.abilityCooldownFrames).toBeGreaterThan(0);
  expect(player.ship.abilityActiveFrames).toBeGreaterThan(0);
});
