import type { HaulerUtilityId } from '../../../shared-types';

export const HAULER_UTILITY = {
  boost_coupling: {
    id: 'boost_coupling',
    name: 'Boost Coupling',
    hint: 'Tap to equip',
    copy: 'E or ARM aims at the nearest furnace. E or IGNITE launches self-guided delivery and earns you points. Swap tools to cancel before ignition.',
  },
  resource_tap: {
    id: 'resource_tap',
    name: 'Resource Tap',
    hint: 'Tap to equip',
    copy: 'Tap an asteroid for resources or a spider for silk. Spiders shudder and turn hostile.',
  },
  tow_cable: {
    id: 'tow_cable',
    name: 'Tow Cable',
    hint: 'Tap to equip',
    copy: 'Aim and fire a tow line at an asteroid, wreck, or spider. Missed lines reel back. E again releases cargo.',
  },
} as const satisfies {
  [Id in HaulerUtilityId]: { id: Id; name: string; hint: string; copy: string };
};
