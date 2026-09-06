import type { Position, Velocity } from '../../../shared-types';
import { getShipKit, SHIP_ABILITY, type ShipAbilityId, type ShipKitId } from './shipKits';

export interface AbilityHost {
  kitId: ShipKitId;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  health: number;
  abilityCooldownFrames: number;
  abilityActiveFrames: number;
  shieldTimer: number;
  magnetTimer: number;
}

export interface AbilityBody {
  position: Position;
  velocity: Velocity;
}

export interface AbilityWorld {
  asteroids: AbilityBody[];
  entities: AbilityBody[];
}

export interface AbilityActivation {
  activated: boolean;
  abilityId?: ShipAbilityId;
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
  if (host.magnetTimer > 0) {
    host.magnetTimer -= 1;
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

export function pullMagnetTargets(host: AbilityHost, asteroids: AbilityBody[]): void {
  if (host.magnetTimer <= 0) {
    return;
  }
  for (const asteroid of asteroids) {
    const dist = Math.hypot(
      asteroid.position.x - host.position.x,
      asteroid.position.y - host.position.y
    );
    if (dist > SHIP_ABILITY.MAGNET_RADIUS || dist < 1) {
      continue;
    }
    const falloff = 1 - dist / SHIP_ABILITY.MAGNET_RADIUS;
    pullBody(asteroid, host.position, SHIP_ABILITY.MAGNET_PULL * falloff);
  }
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

/**
 * Activate the host's kit ability. World effects (magnet pull / shock) apply
 * when a world is passed — server is authoritative for those.
 */
export function activateAbilityOnHost(host: AbilityHost, world?: AbilityWorld): AbilityActivation {
  if (!canActivateAbility(host)) {
    return { activated: false };
  }

  const kit = getShipKit(host.kitId);
  host.abilityCooldownFrames = SHIP_ABILITY.COOLDOWN_FRAMES[kit.id];

  switch (kit.abilityId) {
    case 'boostDash': {
      const boost = headingVelocity(host.angle, SHIP_ABILITY.DASH_BOOST);
      host.velocity.x += boost.x;
      host.velocity.y += boost.y;
      host.abilityActiveFrames = 12;
      break;
    }
    case 'lootMagnet':
      host.magnetTimer = SHIP_ABILITY.MAGNET_FRAMES;
      host.abilityActiveFrames = SHIP_ABILITY.MAGNET_FRAMES;
      break;
    case 'shieldFocus':
      host.shieldTimer = SHIP_ABILITY.SHIELD_FRAMES;
      host.abilityActiveFrames = SHIP_ABILITY.SHIELD_FRAMES;
      break;
    case 'burstFire':
      host.abilityActiveFrames = 8;
      break;
    case 'shockPulse':
      host.abilityActiveFrames = 18;
      if (world) {
        applyShockPulse(host, world);
      }
      break;
  }

  return { activated: true, abilityId: kit.abilityId };
}
