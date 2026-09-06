import { areAllied } from '../../../shared/factions';
import type { Position, SoftFactionId, Velocity } from '../../../shared-types';
import { getHarpoonField, getHarpoonFieldScale } from './harpoonField';
import { getShipKit, SHIP_ABILITY, type ShipAbilityId, type ShipKitId } from './shipKits';

export interface AbilityHost {
  id?: string;
  kitId: ShipKitId;
  factionId?: SoftFactionId;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  health: number;
  abilityCooldownFrames: number;
  abilityActiveFrames: number;
  shieldTimer: number;
  harpoonTimer: number;
  harpoonTargetId?: string;
}

export interface AbilityBody {
  id?: string;
  position: Position;
  velocity: Velocity;
  factionId?: SoftFactionId;
  exploding?: boolean;
  health?: number;
  shieldTimer?: number;
  /** Timed ship shield (#454). Separate from Warden kit `shieldTimer`. */
  shieldActive?: boolean;
}

export interface AbilityWorld {
  asteroids: AbilityBody[];
  entities: AbilityBody[];
}

export interface AbilityActivation {
  activated: boolean;
  abilityId?: ShipAbilityId;
}

export interface HarpoonLatchSnapshot {
  harpoonTimer?: number;
  harpoonTargetId?: string;
}

function headingVelocity(angle: number, magnitude: number): Velocity {
  return {
    x: Math.cos(angle) * magnitude,
    y: -Math.sin(angle) * magnitude,
  };
}

export function canActivateAbility(host: AbilityHost): boolean {
  return !host.exploding && host.health > 0 && host.abilityCooldownFrames <= 0;
}

export function absorbDamageWithShield(host: { shieldTimer: number }): boolean {
  return host.shieldTimer > 0;
}

export function clearHarpoonLatch(
  host: Pick<AbilityHost, 'harpoonTimer' | 'harpoonTargetId'>
): void {
  host.harpoonTimer = 0;
  host.harpoonTargetId = undefined;
}

/** Rocks + ships share one latch list. Server and client use the same helper. */
export function listHarpoonCandidates(world?: AbilityWorld): AbilityBody[] {
  if (world) {
    return [...world.asteroids, ...world.entities];
  }
  return [...getHarpoonField()];
}

export function isHarpoonableBody(
  host: Pick<AbilityHost, 'id' | 'factionId'>,
  body: AbilityBody
): boolean {
  if (!body.id || body.id === host.id) {
    return false;
  }
  if (body.exploding || (body.health !== undefined && body.health <= 0)) {
    return false;
  }
  if ((body.shieldTimer ?? 0) > 0 || body.shieldActive) {
    return false;
  }
  if (areAllied(host.factionId, body.factionId)) {
    return false;
  }
  return true;
}

export function tickAbilityHost(host: AbilityHost): void {
  if (host.abilityCooldownFrames > 0) {
    host.abilityCooldownFrames -= 1;
  }
  if (host.abilityActiveFrames > 0) {
    host.abilityActiveFrames -= 1;
  }
  if (host.shieldTimer > 0) {
    host.shieldTimer -= 1;
  }
  if (host.harpoonTimer > 0) {
    host.harpoonTimer -= 1;
    if (host.harpoonTimer <= 0 || host.kitId !== 'hauler') {
      clearHarpoonLatch(host);
    }
  } else if (host.kitId !== 'hauler' && host.harpoonTargetId) {
    clearHarpoonLatch(host);
  }
}

/**
 * Local predicts; remotes stay snapshot-driven. A later server latch
 * (timer > 0) wins so both clients draw the same tether.
 */
export function applySharedHarpoonLatch(
  host: Pick<AbilityHost, 'kitId' | 'harpoonTimer' | 'harpoonTargetId'>,
  snapshot: HarpoonLatchSnapshot,
  role: 'predicting' | 'authoritative' = 'authoritative'
): void {
  if (host.kitId !== 'hauler') {
    clearHarpoonLatch(host);
    return;
  }
  if (snapshot.harpoonTimer === undefined && snapshot.harpoonTargetId === undefined) {
    return;
  }
  if (snapshot.harpoonTimer !== undefined && snapshot.harpoonTimer > 0) {
    host.harpoonTimer = snapshot.harpoonTimer;
    if (snapshot.harpoonTargetId !== undefined) {
      host.harpoonTargetId = snapshot.harpoonTargetId || undefined;
    }
    return;
  }
  if (role === 'predicting') {
    return;
  }
  if (snapshot.harpoonTimer !== undefined) {
    host.harpoonTimer = snapshot.harpoonTimer;
  }
  if (snapshot.harpoonTargetId !== undefined) {
    host.harpoonTargetId = snapshot.harpoonTargetId || undefined;
  }
  if (host.harpoonTimer <= 0) {
    host.harpoonTargetId = undefined;
  }
}

function pushBody(body: AbilityBody, toward: Position, force: number): void {
  const dx = body.position.x - toward.x;
  const dy = body.position.y - toward.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return;
  }
  body.velocity.x += (dx / dist) * force;
  body.velocity.y += (dy / dist) * force;
}

function pullBody(body: AbilityBody, toward: Position, force: number): void {
  const dx = toward.x - body.position.x;
  const dy = toward.y - body.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return;
  }
  body.velocity.x += (dx / dist) * force;
  body.velocity.y += (dy / dist) * force;
}

/** World-unit latch reach. Zoomed playfields make a 280wu rock look adjacent. */
export function harpoonLatchRange(playfieldScale = 1): number {
  if (!Number.isFinite(playfieldScale) || playfieldScale >= 1 || playfieldScale <= 0) {
    return SHIP_ABILITY.HARPOON_RANGE;
  }
  return Math.min(
    SHIP_ABILITY.HARPOON_RANGE / Math.max(playfieldScale, 0.28),
    SHIP_ABILITY.HARPOON_RANGE * 2.5
  );
}

export function findHarpoonTarget(
  host: Pick<AbilityHost, 'id' | 'factionId' | 'position' | 'angle'>,
  bodies: AbilityBody[],
  range: number = SHIP_ABILITY.HARPOON_RANGE
): AbilityBody | undefined {
  const hx = Math.cos(host.angle);
  const hy = -Math.sin(host.angle);
  let best: { body: AbilityBody; dist: number; facing: number } | undefined;

  for (const body of bodies) {
    if (!isHarpoonableBody(host, body)) {
      continue;
    }
    const dx = body.position.x - host.position.x;
    const dy = body.position.y - host.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) {
      continue;
    }
    const facing = (dx * hx + dy * hy) / dist;
    if (
      !best ||
      (facing > 0 && best.facing <= 0) ||
      (facing > 0 === best.facing > 0 && dist < best.dist)
    ) {
      best = { body, dist, facing };
    }
  }

  return best?.body;
}

function latchStillValid(host: AbilityHost, target: AbilityBody): boolean {
  if (!isHarpoonableBody(host, target)) {
    return false;
  }
  const dist = Math.hypot(target.position.x - host.position.x, target.position.y - host.position.y);
  return dist <= SHIP_ABILITY.HARPOON_RANGE * SHIP_ABILITY.HARPOON_SLACK;
}

/** Hauler-only: haul the latched rock or ship. Other kits never pull. */
export function pullHarpoonTarget(host: AbilityHost, bodies: AbilityBody[]): void {
  if (host.kitId !== 'hauler' || host.harpoonTimer <= 0 || !host.harpoonTargetId) {
    if (host.kitId !== 'hauler') {
      clearHarpoonLatch(host);
    }
    return;
  }

  const target = bodies.find((body) => body.id === host.harpoonTargetId);
  if (!target || !latchStillValid(host, target)) {
    clearHarpoonLatch(host);
    return;
  }

  const dist = Math.hypot(target.position.x - host.position.x, target.position.y - host.position.y);
  const falloff = 1 - Math.min(dist, SHIP_ABILITY.HARPOON_RANGE) / SHIP_ABILITY.HARPOON_RANGE;
  pullBody(target, host.position, SHIP_ABILITY.HARPOON_PULL * Math.max(0.25, falloff));
}

export function applyShockPulse(host: AbilityHost, world: AbilityWorld): void {
  for (const asteroid of world.asteroids) {
    const dist = Math.hypot(
      asteroid.position.x - host.position.x,
      asteroid.position.y - host.position.y
    );
    if (dist > SHIP_ABILITY.SHOCK_RADIUS || dist < 1) {
      continue;
    }
    const falloff = 1 - dist / SHIP_ABILITY.SHOCK_RADIUS;
    pushBody(asteroid, host.position, SHIP_ABILITY.SHOCK_FORCE * falloff);
  }
  for (const entity of world.entities) {
    const dist = Math.hypot(
      entity.position.x - host.position.x,
      entity.position.y - host.position.y
    );
    if (dist > SHIP_ABILITY.SHOCK_RADIUS || dist < 1) {
      continue;
    }
    const falloff = 1 - dist / SHIP_ABILITY.SHOCK_RADIUS;
    pushBody(entity, host.position, SHIP_ABILITY.SHOCK_FORCE * falloff);
  }
}

export function resolveAbilityWorld(world?: AbilityWorld): AbilityWorld | undefined {
  if (world) {
    return world;
  }
  const field = getHarpoonField();
  if (field.length === 0) {
    return undefined;
  }
  const asteroids: AbilityBody[] = [];
  const entities: AbilityBody[] = [];
  for (const body of field) {
    if (body.kind === 'ship') {
      entities.push(body);
    } else {
      asteroids.push(body);
    }
  }
  return { asteroids, entities };
}

/**
 * Activate the host's kit ability. World effects (harpoon haul / shock) apply
 * when a world is passed — server is authoritative for those.
 */
export function activateAbilityOnHost(host: AbilityHost, world?: AbilityWorld): AbilityActivation {
  if (!canActivateAbility(host)) {
    return { activated: false };
  }

  const kit = getShipKit(host.kitId);
  const resolved = resolveAbilityWorld(world);

  if (kit.abilityId === 'harpoon') {
    if (host.kitId !== 'hauler') {
      return { activated: false };
    }
    const latchRange = world
      ? SHIP_ABILITY.HARPOON_RANGE
      : harpoonLatchRange(getHarpoonFieldScale());
    const target = findHarpoonTarget(host, listHarpoonCandidates(resolved), latchRange);
    if (!target?.id) {
      return { activated: false };
    }
    host.abilityCooldownFrames = SHIP_ABILITY.COOLDOWN_FRAMES[kit.id];
    host.harpoonTargetId = target.id;
    host.harpoonTimer = SHIP_ABILITY.HARPOON_FRAMES;
    host.abilityActiveFrames = SHIP_ABILITY.HARPOON_FRAMES;
    return { activated: true, abilityId: 'harpoon' };
  }

  host.abilityCooldownFrames = SHIP_ABILITY.COOLDOWN_FRAMES[kit.id];

  switch (kit.abilityId) {
    case 'boostDash': {
      const boost = headingVelocity(host.angle, SHIP_ABILITY.DASH_BOOST);
      host.velocity.x += boost.x;
      host.velocity.y += boost.y;
      host.abilityActiveFrames = 12;
      break;
    }
    case 'shieldFocus':
      host.shieldTimer = SHIP_ABILITY.SHIELD_FRAMES;
      host.abilityActiveFrames = SHIP_ABILITY.SHIELD_FRAMES;
      break;
    case 'burstFire':
      host.abilityActiveFrames = 8;
      break;
    case 'shockPulse':
      host.abilityActiveFrames = 18;
      if (resolved) {
        applyShockPulse(host, resolved);
      }
      break;
  }

  return { activated: true, abilityId: kit.abilityId };
}
