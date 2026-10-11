import type { HaulerUtilityId, ScoutUtilityId, ShipKitId } from '../shared-types';

const haulerUtilities = {
  tow_cable: 'tow_cable',
  resource_tap: 'resource_tap',
  boost_coupling: 'boost_coupling',
} as const satisfies { [Id in HaulerUtilityId]: Id };
const scoutUtilities = {
  mineral_scan: 'mineral_scan',
  survey_probe: 'survey_probe',
} as const satisfies { [Id in ScoutUtilityId]: Id };

export const HAULER_UTILITY_IDS: readonly HaulerUtilityId[] = Object.values(haulerUtilities);
export const SCOUT_UTILITY_IDS: readonly ScoutUtilityId[] = Object.values(scoutUtilities);

/** Haulers fly the freely available Tow Cable unless another owned tool is equipped. */
export const DEFAULT_HAULER_UTILITY: HaulerUtilityId = 'tow_cable';
export const DEFAULT_SCOUT_UTILITY: ScoutUtilityId = 'mineral_scan';

export function isHaulerUtilityId(value: unknown): value is HaulerUtilityId {
  return typeof value === 'string' && Object.hasOwn(haulerUtilities, value);
}

export function isScoutUtilityId(value: unknown): value is ScoutUtilityId {
  return typeof value === 'string' && Object.hasOwn(scoutUtilities, value);
}

export function parseHaulerUtilityId(value: unknown): HaulerUtilityId {
  return isHaulerUtilityId(value) ? value : DEFAULT_HAULER_UTILITY;
}

export function parseScoutUtilityId(value: unknown): ScoutUtilityId {
  return isScoutUtilityId(value) ? value : DEFAULT_SCOUT_UTILITY;
}

export function haulerUtilityOf(host: {
  kitId?: ShipKitId | string;
  haulerUtility?: unknown;
}): HaulerUtilityId {
  return host.kitId === 'hauler'
    ? parseHaulerUtilityId(host.haulerUtility)
    : DEFAULT_HAULER_UTILITY;
}

export function scoutUtilityOf(host: {
  kitId?: ShipKitId | string;
  scoutUtility?: unknown;
}): ScoutUtilityId {
  return host.kitId === 'scout' ? parseScoutUtilityId(host.scoutUtility) : DEFAULT_SCOUT_UTILITY;
}

export function isTowCableUtility(host: {
  kitId?: ShipKitId | string;
  haulerUtility?: unknown;
}): boolean {
  return host.kitId === 'hauler' && haulerUtilityOf(host) === 'tow_cable';
}

export function isResourceTapUtility(host: {
  kitId?: ShipKitId | string;
  haulerUtility?: unknown;
}): boolean {
  return host.kitId === 'hauler' && haulerUtilityOf(host) === 'resource_tap';
}
