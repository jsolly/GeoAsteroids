import type { ShipKitId } from '../../../shared-types';
import { SHIP } from '../../constants';

export type { ShipKitId };

export const SHIP_KIT_IDS = ['dart', 'hauler', 'warden', 'skirmisher', 'quake'] as const;

export const DEFAULT_SHIP_KIT_ID: ShipKitId = 'dart';

/** Ability flavor — geo is optional spice, not a kit requirement. */
export type ShipAbilityFlavor = 'combat' | 'utility' | 'geo';

export type ShipAbilityId = 'boostDash' | 'lootMagnet' | 'shieldFocus' | 'burstFire' | 'shockPulse';

export interface HullProfile {
  nose: number;
  rear: number;
  beam: number;
}

export interface ShipKit {
  id: ShipKitId;
  name: string;
  abilityId: ShipAbilityId;
  abilityName: string;
  abilityHint: string;
  flavor: ShipAbilityFlavor;
  maxHealth: number;
  size: number;
  thrust: number;
  maxVelocity: number;
  turnSpeed: number;
  shotCooldown: number;
  burstCount: number;
  hull: HullProfile;
}

/** Classic triangle. TEMPORARY: AD pack held — kits share this until outline deltas land. */
export const CLASSIC_HULL: HullProfile = {
  nose: 1,
  rear: 0.8,
  beam: 0.5,
};

/** All player kits use this until the Art Director pack ships stronger nose/aft/aspect deltas. */
export const KIT_HULL_PLACEHOLDER = CLASSIC_HULL;
export const KIT_HULLS_ARE_PLACEHOLDERS = true;

export const SHIP_ABILITY = {
  DASH_BOOST: 6,
  MAGNET_RADIUS: 280,
  MAGNET_FRAMES: 90,
  MAGNET_PULL: 0.28,
  SHIELD_FRAMES: 180,
  BURST_SPREAD: 0.12,
  SHOCK_RADIUS: 200,
  SHOCK_FORCE: 3.2,
  COOLDOWN_FRAMES: {
    dart: 90,
    hauler: 180,
    warden: 150,
    skirmisher: 150,
    quake: 180,
  },
} as const;

const KITS: Record<ShipKitId, ShipKit> = {
  dart: {
    id: 'dart',
    name: 'Dart',
    abilityId: 'boostDash',
    abilityName: 'Boost dash',
    abilityHint: 'Short burst of speed',
    flavor: 'combat',
    maxHealth: SHIP.MAX_HEALTH,
    size: SHIP.SIZE,
    thrust: SHIP.THRUST,
    maxVelocity: SHIP.MAX_VELOCITY,
    turnSpeed: SHIP.TURN_SPEED,
    shotCooldown: 250,
    burstCount: 1,
    hull: KIT_HULL_PLACEHOLDER,
  },
  hauler: {
    id: 'hauler',
    name: 'Hauler',
    abilityId: 'lootMagnet',
    abilityName: 'Loot magnet',
    abilityHint: 'Pull nearby debris',
    flavor: 'utility',
    maxHealth: 140,
    size: 38,
    thrust: 4,
    maxVelocity: 6,
    turnSpeed: 380,
    shotCooldown: 280,
    burstCount: 1,
    hull: KIT_HULL_PLACEHOLDER,
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    abilityId: 'shieldFocus',
    abilityName: 'Shield',
    abilityHint: 'Absorb hits for a moment',
    flavor: 'combat',
    maxHealth: 120,
    size: 32,
    thrust: SHIP.THRUST,
    maxVelocity: 7,
    turnSpeed: SHIP.TURN_SPEED,
    shotCooldown: 260,
    burstCount: 1,
    hull: KIT_HULL_PLACEHOLDER,
  },
  skirmisher: {
    id: 'skirmisher',
    name: 'Skirmisher',
    abilityId: 'burstFire',
    abilityName: 'Burst fire',
    abilityHint: 'Three-shot volley',
    flavor: 'combat',
    maxHealth: 80,
    size: 28,
    thrust: 5.4,
    maxVelocity: 8.5,
    turnSpeed: 540,
    shotCooldown: 200,
    burstCount: 3,
    hull: KIT_HULL_PLACEHOLDER,
  },
  quake: {
    id: 'quake',
    name: 'Quake',
    abilityId: 'shockPulse',
    abilityName: 'Shock pulse',
    abilityHint: 'Knock nearby rocks and ships',
    flavor: 'geo',
    maxHealth: 110,
    size: 34,
    thrust: SHIP.THRUST,
    maxVelocity: SHIP.MAX_VELOCITY,
    turnSpeed: SHIP.TURN_SPEED,
    shotCooldown: 270,
    burstCount: 1,
    hull: KIT_HULL_PLACEHOLDER,
  },
};

export function isShipKitId(value: unknown): value is ShipKitId {
  return typeof value === 'string' && (SHIP_KIT_IDS as readonly string[]).includes(value);
}

export function parseShipKitId(value: unknown): ShipKitId {
  return isShipKitId(value) ? value : DEFAULT_SHIP_KIT_ID;
}

export function getShipKit(kitId: unknown): ShipKit {
  return KITS[parseShipKitId(kitId)];
}

export function listShipKits(): ShipKit[] {
  return SHIP_KIT_IDS.map((id) => KITS[id]);
}

export interface KitStatTarget {
  kitId: ShipKitId;
  maxHealth: number;
  health: number;
}

export interface KitShipTarget extends KitStatTarget {
  r: number;
  shotCooldown: number;
  thrust: number;
  maxVelocity: number;
  turnSpeed: number;
}

/** Shared human + bot kit application. Does not touch playfield colors. */
export function applyShipKitStats(target: KitStatTarget, kitId: unknown): ShipKit {
  const kit = getShipKit(kitId);
  target.kitId = kit.id;
  target.maxHealth = kit.maxHealth;
  target.health = kit.maxHealth;
  return kit;
}

export function applyShipKitToShip(ship: KitShipTarget, kitId: unknown): ShipKit {
  const kit = applyShipKitStats(ship, kitId);
  ship.r = kit.size / 2;
  ship.shotCooldown = kit.shotCooldown;
  ship.thrust = kit.thrust;
  ship.maxVelocity = kit.maxVelocity;
  ship.turnSpeed = kit.turnSpeed;
  return kit;
}
