import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { decodeClientCommand } from '../../../server/communication/clientCommandDecoder';
import { CooperativeContourBridges } from '../../../server/core/CooperativeContourBridges';
import { CONTOUR_BRIDGE } from '../../../shared/contourBridge';
import {
  CONTOUR_LOCK,
  contourLockDistance,
  contourLockVelocity,
} from '../../../shared/contourLock';
import { cargoCapacity } from '../../../shared/economy';
import { sampleGradient, sampleHeight } from '../../../shared/heightfield';
import { cruiseSpeed } from '../../../shared/shipFlight';
import { getShipKit } from '../../../shared/shipKits';
import { validateSnapshotDto } from '../../../shared/snapshotDto';
import { SnapshotEncoder } from '../../../shared/snapshotProtocol';
import { TERRAIN } from '../../../shared/terrainConfig';
import { getTerrainField } from '../../../shared/terrainField';
import { terrainCruiseVelocity } from '../../../shared/terrainTravel';
import type { ContourLockState, Position } from '../../../shared-types';
import { Player } from '../../../src/entities/player/Player';
import { Ship } from '../../../src/entities/ship/Ship';

import { PlayerMotionReconciliation } from '../../../src/network/services/PlayerMotionReconciliation';
import { RecordingSocket } from '../../support/recordingSocket';
import { GameServerWorld, useQuietServerConsole } from '../scenarios/support/gameServerWorld';

useQuietServerConsole();
let world: GameServerWorld;
beforeEach(() => {
  world = new GameServerWorld();
});
afterEach(() => {
  world.dispose();
  vi.restoreAllMocks();
});

function railPilot() {
  const pilot = world.join('Rail pilot', { x: 2250, y: 0 });
  const actor = world.entity(pilot);
  world.clearAsteroids();
  const state: ContourLockState = {
    height:
      Math.round(
        sampleHeight(getTerrainField(), actor.position.x, actor.position.y) /
          TERRAIN.CONTOUR_INTERVAL
      ) * TERRAIN.CONTOUR_INTERVAL,
    direction: 1,
  };
  // Project the fixture onto a canonical visible level using bounded Newton steps.
  for (let step = 0; step < 6; step++) {
    const gradient = sampleGradient(getTerrainField(), actor.position.x, actor.position.y);
    const error =
      state.height - sampleHeight(getTerrainField(), actor.position.x, actor.position.y);
    const scale = error / (gradient.x ** 2 + gradient.y ** 2);
    actor.position = {
      x: actor.position.x + gradient.x * scale,
      y: actor.position.y + gradient.y * scale,
    };
  }
  world.engine.playerMotion.placeActorForTesting(
    actor.id,
    actor.position,
    world.engine.getServerTime()
  );
  const cruise = cruiseSpeed(actor.mass, getShipKit(actor.kitId).maxVelocity, 0, 1);
  const now = world.engine.getServerTime();
  let sequence = 0;
  const pose = (
    at: number,
    contourLock: ContourLockState | null = state,
    position: Position = actor.position,
    velocity: Position = { x: 0, y: 0 }
  ) =>
    world.engine.playerMotion.acceptFreePose(
      pilot.socket,
      {
        epoch: actor.playerMotion?.epoch ?? 0,
        sequence: ++sequence,
        position: { ...position },
        velocity,
        angle: 0,
        thrusting: true,
        contourLock,
      },
      now + at
    );
  return { pilot, actor, state, cruise, now, pose };
}

test('a pilot follows curved contour guidance continuously with no charge or timer', () => {
  const { actor, state, cruise, pose } = railPilot();
  for (let frame = 1; frame <= 600; frame++) {
    const velocity = contourLockVelocity(actor.position, state, cruise);
    if (!velocity) {
      throw new Error('Lost fixture contour');
    }
    const position = { x: actor.position.x + velocity.x, y: actor.position.y + velocity.y };
    const outcome = pose((frame * 1000) / 60, state, position, velocity);
    expect(outcome.ok, JSON.stringify({ outcome, frame, position: actor.position })).toBe(true);
    expect(contourLockDistance(actor.position, state)).toBeLessThan(CONTOUR_LOCK.railTolerance);
  }
  expect(actor.contourLock).toEqual(state);
});

test('a ship accelerates into a nearby contour within the acquisition deadline', () => {
  const { actor, state, pose } = railPilot();
  const gradient = sampleGradient(getTerrainField(), actor.position.x, actor.position.y);
  const offset = state;
  const magnitude = Math.hypot(gradient.x, gradient.y);
  actor.position = {
    x: actor.position.x - (gradient.x / magnitude) * 30,
    y: actor.position.y - (gradient.y / magnitude) * 30,
  };
  const ship = new Ship({
    kitId: actor.kitId,
    position: { ...actor.position },
    isLocalPlayer: true,
  });
  ship.contourLock = offset;
  for (let frame = 1; frame <= 60; frame++) {
    ship.update();
    const outcome = pose((frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
    expect(outcome.ok, JSON.stringify({ outcome, frame, position: actor.position })).toBe(true);
  }
  expect(actor.contourLock).toEqual(offset);
  expect(contourLockDistance(actor.position, offset)).toBeLessThan(CONTOUR_LOCK.railTolerance);
});

test.each([0.1, 1])(
  'a pilot crossing a contour at %s cruise can publish lock intent before the next movement tick',
  (speedFraction) => {
    const { actor, cruise, pose } = railPilot();
    const ship = new Ship({ kitId: actor.kitId, position: { ...actor.position } });
    const gradient = sampleGradient(getTerrainField(), ship.position.x, ship.position.y);
    ship.angle = Math.atan2(-gradient.y, gradient.x);
    ship.velocity = {
      x: Math.cos(ship.angle) * cruise * speedFraction,
      y: -Math.sin(ship.angle) * cruise * speedFraction,
    };
    expect(pose(0, null, ship.position, ship.velocity).ok).toBe(true);
    const position = { ...ship.position };
    const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
    expect(ship.toggleContourLock()).toBe(true);
    expect(ship.position).toEqual(position);
    expect(Math.hypot(ship.velocity.x, ship.velocity.y)).toBeCloseTo(speed);
    expect(ship.angle).toBeCloseTo(Math.atan2(-ship.velocity.y, ship.velocity.x));
    // No Ship.update occurs between the input event and this network pose.
    expect(pose(1, ship.contourLock, ship.position, ship.velocity).ok).toBe(true);
    const lock = ship.contourLock;
    for (let frame = 1; frame <= 90; frame++) {
      ship.update();
      const outcome = pose(1 + (frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
      expect(outcome.ok, JSON.stringify({ frame, outcome })).toBe(true);
      expect(actor.contourLock).toEqual(lock);
      expect(ship.contourLock).toEqual(lock);
    }
  }
);

test('a buffered curved rail route retains the server-stall travel credit', () => {
  const { actor, state, cruise, pose, now } = railPilot();
  expect(pose(0).ok).toBe(true);
  const frames = 96;
  const blockedMs = (frames * 1000) / 60;
  let position = { ...actor.position };
  let velocity = { x: 0, y: 0 };
  for (let frame = 0; frame < frames; frame++) {
    const next = contourLockVelocity(position, state, cruise);
    if (!next) {
      throw new Error('Missing fixture rail');
    }
    velocity = next;
    position = { x: position.x + velocity.x, y: position.y + velocity.y };
  }
  expect(contourLockDistance(position, state)).toBeLessThan(CONTOUR_LOCK.railTolerance);
  world.engine.playerMotion.recordBlockedSpan(now, now + blockedMs);
  const outcome = pose(blockedMs, state, position, velocity);
  expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
  expect(outcome).toEqual({ ok: true, blockedMs });
  expect(actor.position).toEqual(position);
});

test('a fabricated level between visible contours is refused', () => {
  const { state, pose } = railPilot();
  expect(pose(0, { ...state, height: state.height + TERRAIN.CONTOUR_INTERVAL / 2 }).ok).toBe(false);
});

test('a claimed forward velocity cannot hide backwards rail displacement', () => {
  const { actor, state, cruise, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  const backwards = contourLockVelocity(actor.position, { ...state, direction: -1 }, cruise);
  const forward = contourLockVelocity(actor.position, state, cruise);
  if (!backwards || !forward) {
    throw new Error('Missing fixture guidance');
  }
  const position = { x: actor.position.x + backwards.x, y: actor.position.y + backwards.y };
  expect(pose(17, state, position, forward).ok).toBe(false);
});

test.each([
  { displacement: 0.259, speed: 0 },
  { displacement: 1.264, speed: 0.812 },
])('a new lock tolerates the final $displacement units of free flight only once', (residual) => {
  const { actor, state, cruise, pose } = railPilot();
  const forward = contourLockVelocity(actor.position, state, cruise);
  if (!forward) {
    throw new Error('Missing fixture guidance');
  }
  const magnitude = Math.hypot(forward.x, forward.y);
  const dx = (forward.x / magnitude) * residual.displacement;
  const dy = (forward.y / magnitude) * residual.displacement;
  const velocity = {
    x: (forward.x / magnitude) * residual.speed,
    y: (forward.y / magnitude) * residual.speed,
  };
  // This packet contains free flight before the button press plus new lock intent.
  const position = { x: actor.position.x - dx, y: actor.position.y - dy };
  expect(pose(30, state, position, velocity).ok).toBe(true);
  const backwards = { x: actor.position.x - dx, y: actor.position.y - dy };
  const rejected = pose(60, state, backwards, velocity);
  expect(rejected.ok).toBe(false);
  if (!rejected.ok) {
    expect(rejected.envelope?.check).toBe('rail');
  }
});

test('a new lock cannot disguise a larger backwards jump as free-flight residue', () => {
  const { actor, state, cruise, pose } = railPilot();
  const forward = contourLockVelocity(actor.position, state, cruise);
  if (!forward) {
    throw new Error('Missing fixture guidance');
  }
  const position = { x: actor.position.x - forward.x, y: actor.position.y - forward.y };
  expect(pose(30, state, position, { x: 0, y: 0 }).ok).toBe(false);
});

test.each([1, 3])(
  'a cruising pilot catches a rail after %s unreported free-flight ticks',
  (ticks) => {
    const { actor, pose, now } = railPilot();
    for (const y of [10, 20, 30]) {
      const ship = new Ship({ position: { x: 2200, y }, kitId: actor.kitId });
      const gradient = sampleGradient(getTerrainField(), ship.position.x, ship.position.y);
      ship.angle = Math.atan2(-gradient.x, -gradient.y);
      ship.velocity = terrainCruiseVelocity(
        ship.position,
        ship.angle,
        cruiseSpeed(ship.mass, ship.maxVelocity, 0, 1)
      );
      world.engine.playerMotion.placeActorForTesting(actor.id, ship.position, now);
      actor.velocity = { ...ship.velocity };
      for (let frame = 0; frame < ticks; frame++) {
        ship.update();
      }
      expect(ship.toggleContourLock()).toBe(true);
      ship.update();
      const outcome = pose(
        ((ticks + 1) * 1000) / 60,
        ship.contourLock,
        ship.position,
        ship.velocity
      );
      expect(outcome.ok, JSON.stringify({ y, ticks, outcome })).toBe(true);
      expect(actor.contourLock).toEqual(ship.contourLock);
    }
  }
);

test('a forward velocity cannot hide a sideways shortcut during capture', () => {
  const { actor, state, cruise, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  const gradient = sampleGradient(getTerrainField(), actor.position.x, actor.position.y);
  const magnitude = Math.hypot(gradient.x, gradient.y);
  const position = {
    x: actor.position.x + (gradient.x / magnitude) * 12,
    y: actor.position.y + (gradient.y / magnitude) * 12,
  };
  const velocity = contourLockVelocity(position, state, cruise);
  if (!velocity) {
    throw new Error('Missing fixture rail');
  }
  const outcome = pose(100, state, position, velocity);
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) {
    expect(outcome.envelope?.check).toBe('rail');
  }
});

test('equipment loot preserves the contour lock and current motion epoch', () => {
  const { actor, state, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  const epoch = actor.playerMotion?.epoch;
  const mass = actor.mass;
  world.engine.dropEquipmentAt(actor.position, 'survey_probe');
  expect(world.engine.collectLoot()).toHaveLength(1);
  expect(actor.mass).toBe(mass);
  expect(actor.contourLock).toEqual(state);
  expect(actor.playerMotion?.epoch).toBe(epoch);
  expect(pose(17).ok).toBe(true);
});

test('a crew laser passing through a hull is not a collision', () => {
  const { actor, pilot, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  const shot = world.engine.spawnLaser(
    pilot.id,
    { x: actor.position.x - 80, y: actor.position.y },
    { x: 120, y: 0 }
  );
  if (!shot) {
    throw new Error('Missing fixture shot');
  }
  world.engine.advanceLasersAndResolveHits();
  expect(actor.contourLock).not.toBeNull();
  expect(shot.hasExploded).toBe(false);
});

test('protected asteroid contact releases the rail without taking health', () => {
  const { actor, pilot, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  const health = actor.health;
  const epoch = actor.playerMotion?.epoch;
  actor.spawnProtectionTimer = 30;
  world.hitAsteroid(pilot);
  expect(actor.health).toBe(health);
  expect(actor.contourLock).toBeNull();
  expect(actor.playerMotion?.epoch).not.toBe(epoch);
});

test.each([0, 30])(
  'a ricochet respects protection %s before changing a locked ship',
  (protection) => {
    const { actor, pilot, pose } = railPilot();
    expect(pose(0).ok).toBe(true);
    actor.spawnProtectionTimer = protection;
    const health = actor.health;
    const shot = world.engine.spawnLaser(
      pilot.id,
      { x: actor.position.x - 80, y: actor.position.y },
      { x: 120, y: 0 }
    );
    if (!shot) {
      throw new Error('Missing fixture shot');
    }
    shot.bounces = 1;
    world.engine.advanceLasersAndResolveHits();
    if (protection) {
      expect(actor.contourLock).not.toBeNull();
      expect(shot.hasExploded).toBe(false);
      expect(actor.health).toBe(health);
    } else {
      expect(actor.contourLock).toBeNull();
      expect(shot.hasExploded).toBe(true);
      expect(actor.health).toBeLessThan(health);
    }
  }
);

test('a pilot cannot select a distant rail or skip a level during a continuous lock', () => {
  const { actor, state, pose } = railPilot();
  expect(pose(0, { ...state, height: state.height + 1 }).ok).toBe(false);
  expect(actor.contourLock).toBeNull();
  expect(pose(1).ok).toBe(true);
  expect(pose(2, { ...state, height: state.height + 2 * TERRAIN.CONTOUR_INTERVAL }).ok).toBe(false);
  expect(actor.contourLock).toBeNull();
});

test('acquisition must converge within its deadline instead of hovering beside the rail', () => {
  const { actor, state, pose } = railPilot();
  const gradient = sampleGradient(getTerrainField(), actor.position.x, actor.position.y);
  const offset = state;
  const magnitude = Math.hypot(gradient.x, gradient.y);
  actor.position = {
    x: actor.position.x - (gradient.x / magnitude) * 20,
    y: actor.position.y - (gradient.y / magnitude) * 20,
  };
  expect(pose(0, offset).ok).toBe(true);
  expect(pose(CONTOUR_LOCK.acquisitionMs, offset).ok).toBe(false);
  expect(actor.contourLock).toBeNull();
});

test('the rail speed cannot be aimed across a contour or carried after release', () => {
  const { actor, state, cruise, pose } = railPilot();
  const velocity = contourLockVelocity(actor.position, state, cruise);
  if (!velocity) {
    throw new Error('Missing fixture rail');
  }
  expect(pose(0, state, actor.position, { x: -velocity.y, y: velocity.x }).ok).toBe(false);
  expect(pose(1, state, actor.position, velocity).ok).toBe(true);
  expect(pose(2, null, actor.position, velocity).ok).toBe(false);
  expect(actor.contourLock).toBeNull();
});

test('release can immediately recapture, while disconnect, impulse, and death clear the lock', () => {
  const { actor, pilot, state, pose, now } = railPilot();
  const motion = world.engine.playerMotion;
  expect(pose(0).ok).toBe(true);
  expect(pose(1, null).ok).toBe(true);
  expect(pose(2).ok).toBe(true);
  motion.applyExternalImpulse(actor.id, now + 3);
  expect(actor.contourLock).toBeNull();
  expect(pose(4).ok).toBe(true);
  motion.transportClosed(pilot.socket, now + 5);
  expect(actor.contourLock).toBeNull();
  expect(motion.resume(pilot.resumeToken, new RecordingSocket(), now + 6).ok).toBe(true);
  expect(actor.contourLock).toBeNull();
  actor.contourLock = state;
  actor.health = 0;
  motion.invalidateLife(actor.id, now + 7);
  expect(actor.contourLock).toBeNull();
});

test.each(['scout', 'hauler'] as const)(
  '%s reports contour speed, fires, and turns across contours without server corrections',
  (kitId) => {
    const pilot = world.join('Contour pilot', { x: 2250, y: 0 }, { kitId });
    const actor = world.entity(pilot);
    world.clearAsteroids();
    const ship = new Ship({ kitId, position: { ...actor.position }, isLocalPlayer: true });
    const gradient = sampleGradient(getTerrainField(), ship.position.x, ship.position.y);
    ship.angle = Math.atan2(-gradient.x, -gradient.y);
    const now = world.engine.getServerTime();
    let fastest = 0;
    for (let frame = 1; frame <= 480; frame++) {
      if (frame % 120 === 0) {
        ship.angle += Math.PI / 2;
      }
      ship.update();
      ship.angle = Math.atan2(Math.sin(ship.angle), Math.cos(ship.angle));
      fastest = Math.max(fastest, Math.hypot(ship.velocity.x, ship.velocity.y));
      const outcome = world.engine.playerMotion.acceptFreePose(
        pilot.socket,
        {
          epoch: actor.playerMotion?.epoch ?? 0,
          sequence: frame,
          position: { ...ship.position },
          velocity: { ...ship.velocity },
          angle: ship.angle,
          thrusting: true,
        },
        now + (frame * 1000) / 60
      );
      expect(outcome.ok, JSON.stringify({ outcome, frame, position: actor.position })).toBe(true);
      if (frame % 30 === 0) {
        const laser = ship.generateLaser();
        expect(
          world.engine.spawnPlayerLaser(
            actor.id,
            laser.position,
            laser.velocity,
            now + (frame * 1000) / 60
          )
        ).not.toBeNull();
      }
    }
    expect(fastest).toBeGreaterThan(getShipKit(kitId).maxVelocity * 1.1);
  }
);

test.each(['constructor', '__proto__', 'unexpected'])(
  'an extra %s field in a contour command cannot poison other pilots snapshots',
  (key) => {
    const { actor, state, pose } = railPilot();
    expect(pose(0).ok).toBe(true);
    const malformed = { ...state, [key]: { nested: { payload: 'invalid lock metadata' } } };
    const decoded = decodeClientCommand({
      type: 'update',
      id: actor.id,
      data: { contourLock: malformed },
    });
    expect(decoded.ok).toBe(false);
    expect(pose(16, malformed).ok).toBe(false);
    expect(actor.contourLock).toEqual(state);
    expect(
      () =>
        new SnapshotEncoder({
          ...world.engine.getGameState(),
          playerProjectiles: [],
        })
    ).not.toThrow();
  }
);

test('a settled pilot glides onto the adjacent rail and the server accepts the whole transition', () => {
  const { actor, state, pose } = railPilot();
  const ship = new Ship({ kitId: actor.kitId, position: { ...actor.position } });
  ship.contourLock = state;
  expect(pose(0).ok).toBe(true);
  const start = { ...ship.position };
  expect(ship.hopContour({ x: -1, y: 0 })).toBe(true);
  expect(ship.position).toEqual(start);
  expect(ship.contourLock).toEqual({
    height: state.height - TERRAIN.CONTOUR_INTERVAL,
    direction: state.direction,
  });
  expect(pose(1, ship.contourLock, ship.position, ship.velocity).ok).toBe(true);
  const target = ship.contourLock;
  expect(ship.hopContour({ x: -1, y: 0 })).toBe(false);
  for (let frame = 1; frame <= 90; frame++) {
    ship.update();
    const outcome = pose(1 + (frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
    expect(outcome.ok, JSON.stringify({ frame, outcome })).toBe(true);
  }
  expect(actor.contourLock).toEqual(target);
  if (!target) {
    throw new Error('Expected hop target');
  }
  expect(contourLockDistance(actor.position, target)).toBeLessThan(CONTOUR_LOCK.railTolerance);
});

test('a hop cannot start another acquisition in mid-glide', () => {
  const { actor, state, pose } = railPilot();
  expect(pose(0).ok).toBe(true);
  expect(pose(3, { height: state.height - TERRAIN.CONTOUR_INTERVAL, direction: 1 }).ok).toBe(true);
  expect(pose(4, state).ok).toBe(false);
  expect(actor.contourLock).toBeNull();
});

test('a buffered flick can catch a rail that came within reach after the last accepted pose', () => {
  world.dispose();
  world = new GameServerWorld(TERRAIN.DEFAULT_SEED);
  const { actor, cruise, now, pose } = railPilot();
  const old: ContourLockState = { height: 0.08, direction: 1 };
  const start = { x: -4995.842222553734, y: -4996.116910407352 };
  world.engine.playerMotion.placeActorForTesting(actor.id, start, now);
  const ship = new Ship({ kitId: actor.kitId, position: { ...start } });
  ship.contourLock = old;
  const velocity = contourLockVelocity(start, old, cruise);
  if (!velocity) {
    throw new Error('Missing initial rail');
  }
  ship.velocity = velocity;
  ship.angle = Math.atan2(-velocity.y, velocity.x);
  expect(pose(0, old, start, velocity).ok).toBe(true);
  const candidate: ContourLockState = { height: 0, direction: 1 };
  expect(contourLockDistance(start, candidate)).toBeGreaterThan(CONTOUR_LOCK.hopRadius);
  for (let frame = 0; frame < 2; frame++) {
    ship.update();
  }
  expect(contourLockDistance(ship.position, candidate)).toBeGreaterThan(CONTOUR_LOCK.captureRadius);
  expect(contourLockDistance(ship.position, candidate)).toBeLessThan(CONTOUR_LOCK.hopRadius);
  expect(ship.hopContour({ x: -0.8967584163341465, y: -0.44252044329485324 })).toBe(true);
  expect(ship.contourLock).toEqual(candidate);
  const outcome = pose((2 * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
  expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
  for (let frame = 3; frame <= 90; frame++) {
    ship.update();
    const result = pose((frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
    expect(result.ok, JSON.stringify({ frame, result })).toBe(true);
  }
  expect(actor.contourLock).toEqual(candidate);
});

test.each([0, 1])('a curved hop can report its new rail after %s movement ticks', (ticks) => {
  world.dispose();
  world = new GameServerWorld(TERRAIN.DEFAULT_SEED);
  const { actor, cruise, now, pose } = railPilot();
  const old: ContourLockState = { height: 0.16, direction: 1 };
  const start = { x: -5003.3253003798745, y: -651.5074246238948 };
  world.engine.playerMotion.placeActorForTesting(actor.id, start, now);
  const ship = new Ship({ kitId: actor.kitId, position: { ...start } });
  ship.contourLock = old;
  const velocity = contourLockVelocity(start, old, cruise);
  if (!velocity) {
    throw new Error('Missing initial rail');
  }
  ship.velocity = velocity;
  ship.angle = Math.atan2(-velocity.y, velocity.x);
  expect(pose(0, old, start, velocity).ok).toBe(true);
  expect(ship.hopContour({ x: -0.4161468365471424, y: 0.9092974268256817 })).toBe(true);
  expect(ship.contourLock).toEqual({ height: 0.08, direction: 1 });
  for (let frame = 0; frame < ticks; frame++) {
    ship.update();
  }
  const result = pose(1 + (ticks * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
  expect(result.ok, JSON.stringify(result)).toBe(true);
});

test.each(['same', 'adjacent'] as const)(
  'a settled pilot can reverse onto the %s rail without teleporting',
  (route) => {
    const { actor, state, cruise, pose } = railPilot();
    const ship = new Ship({ kitId: actor.kitId, position: { ...actor.position } });
    ship.contourLock = state;
    const forward = contourLockVelocity(ship.position, state, cruise);
    if (!forward) {
      throw new Error('Missing fixture guidance');
    }
    ship.velocity = forward;
    expect(pose(0, state, ship.position, ship.velocity).ok).toBe(true);
    const start = { ...ship.position };
    const gradient = sampleGradient(getTerrainField(), start.x, start.y);
    const magnitude = Math.hypot(gradient.x, gradient.y);
    const flick =
      route === 'same'
        ? { x: -forward.x, y: -forward.y }
        : {
            x: (-gradient.x + gradient.y * 0.6) / magnitude,
            y: (-gradient.y - gradient.x * 0.6) / magnitude,
          };
    expect(ship.hopContour(flick)).toBe(true);
    expect(ship.position).toEqual(start);
    expect(ship.contourLock).toEqual({
      height: route === 'same' ? state.height : state.height - TERRAIN.CONTOUR_INTERVAL,
      direction: -1,
    });
    expect(pose(1, ship.contourLock, ship.position, ship.velocity).ok).toBe(true);
    const target = ship.contourLock;
    for (let frame = 1; frame <= 60; frame++) {
      ship.update();
      const result = pose(1 + (frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
      expect(result.ok, JSON.stringify({ frame, result })).toBe(true);
    }
    expect(actor.contourLock).toEqual(target);
  }
);

test.each([
  { x: -5498.79035132918, y: -5497.784770565292, height: 0.24, direction: 1 as const },
  { x: -5498.79035132918, y: -5497.784770565292, height: 0.24, direction: -1 as const },
  { x: -5492.069073525674, y: 1996.0205480837283, height: -0.56, direction: 1 as const },
  { x: -5492.069073525674, y: 1996.0205480837283, height: -0.56, direction: -1 as const },
])(
  'a collision-free pilot stays locked through curved contour $height for forty seconds in direction $direction',
  (fixture) => {
    world.dispose();
    world = new GameServerWorld(TERRAIN.DEFAULT_SEED);
    const { actor, pose, now } = railPilot();
    const ship = new Ship({
      kitId: actor.kitId,
      position: { x: fixture.x, y: fixture.y },
    });
    const lock: ContourLockState = { height: fixture.height, direction: fixture.direction };
    world.engine.playerMotion.placeActorForTesting(actor.id, ship.position, now);
    ship.contourLock = lock;
    expect(pose(0, lock, ship.position, ship.velocity).ok).toBe(true);
    for (let frame = 1; frame <= 2400; frame++) {
      ship.update();
      if (frame % 3 === 0) {
        const outcome = pose((frame * 1000) / 60, ship.contourLock, ship.position, ship.velocity);
        expect(outcome.ok, JSON.stringify({ frame, outcome, position: ship.position })).toBe(true);
      }
      expect(ship.contourLock, `client released at frame ${frame}`).toEqual(lock);
      expect(actor.contourLock, `server released at frame ${frame}`).toEqual(lock);
      expect(contourLockDistance(ship.position, lock)).toBeLessThan(CONTOUR_LOCK.railTolerance);
    }
  }
);

test.each(['distance', 'heading', 'route'] as const)(
  'a rejected contour %s releases the lock and leaves the pilot unlocked',
  (failure) => {
    const { actor, state, cruise, pose, now } = railPilot();

    expect(pose(0).ok).toBe(true);
    const forward = contourLockVelocity(actor.position, state, cruise);
    if (!forward) {
      throw new Error('Missing fixture guidance');
    }
    const position =
      failure === 'route'
        ? { x: actor.position.x - forward.x, y: actor.position.y - forward.y }
        : failure === 'distance'
          ? { x: actor.position.x + 100, y: actor.position.y + 100 }
          : { x: actor.position.x + forward.x, y: actor.position.y + forward.y };
    const velocity = failure === 'heading' ? { x: -forward.x, y: -forward.y } : forward;
    const rejected = pose(1000, state, position, velocity);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) {
      throw new Error('Expected rejection');
    }
    if (failure === 'route') {
      expect(rejected.envelope?.check).toBe('rail');
    } else {
      expect(rejected.contour).toMatchObject({
        reason: `rail-${failure}`,
        position,
        velocity,
        lock: state,
        allowedDistance: 6,
        acquisitionAgeMs: 1000,
      });
      expect(rejected.contour?.gradientMagnitude).toBeGreaterThan(0);
    }
    expect(actor.contourLock).toBeNull();
    world.engine.playerMotion.releaseContourLock(actor.id, now + 1000);

    expect(actor.contourLock).toBeNull();
  }
);

test('a departing locked pilot releases its contour before ownership is removed', () => {
  const { pilot, actor, pose } = railPilot();
  expect(pose(0).ok).toBe(true);

  world.core.handleClientMessage({ type: 'leave', id: actor.id }, pilot.socket);
  world.engine.playerMotion.transportClosed(pilot.socket, world.engine.getServerTime());

  expect(actor.contourLock).toBeNull();
  expect(world.engine.getPlayer(actor.id)).toBeUndefined();
});

function crewBridge() {
  const { actor, pilot, state, pose, now } = railPilot();
  const ship = new Ship({ kitId: actor.kitId, position: { ...actor.position } });
  ship.contourLock = state;
  expect(pose(0).ok).toBe(true);
  let elapsed = 0;
  const performanceOrigin = performance.now();
  vi.spyOn(performance, 'now').mockImplementation(() => performanceOrigin + elapsed);
  const hop = () => {
    const gradient = sampleGradient(getTerrainField(), ship.position.x, ship.position.y);
    return ship.hopContour({ x: -gradient.x, y: -gradient.y }) || ship.hopContour(gradient);
  };
  for (let count = 1; count <= 3; count++) {
    expect(hop(), `hop ${count}`).toBe(true);
    elapsed += 1;
    expect(pose(elapsed, ship.contourLock, ship.position, ship.velocity).ok).toBe(true);
    for (let frame = 0; frame < 60; frame++) {
      elapsed += 1000 / 60;
      ship.update();
      expect(pose(elapsed, ship.contourLock, ship.position, ship.velocity).ok).toBe(true);
    }
  }
  const bridges = world.engine.getSnapshotState().contourBridges ?? [];
  expect(bridges).toHaveLength(3);
  const charged = bridges.find((bridge) => bridge.charged);
  if (!charged) {
    throw new Error('Third accepted hop did not create a charged bridge');
  }
  return { actor, pilot, ship, hop, pose, now, elapsed, charged };
}

test('three accepted adjacent hops charge one crew bridge, followers glide across once, and a fourth hop cannot refill the combo', () => {
  const { pilot, ship, hop, pose, now, elapsed, charged } = crewBridge();
  expect(charged.ownerId).toBe(pilot.id);
  const remote = world.join('Remote pilot', { x: 0, y: 0 });
  world.entity(remote).position = { x: 20000, y: 20000 };
  world.broadcastGameState();
  const snapshot = world.snapshot(pilot);
  validateSnapshotDto(snapshot);
  expect(snapshot.contourBridges).toHaveLength(3);
  expect(world.snapshot(remote).contourBridges).toEqual([]);
  expect(() =>
    validateSnapshotDto({
      ...snapshot,
      contourBridges: [{ ...charged, target: { ...charged.target, direction: 0 } }],
    })
  ).toThrow();
  expect(hop()).toBe(false);
  const forbidden = {
    ...ship.contourLock,
    height: (ship.contourLock?.height ?? 0) + TERRAIN.CONTOUR_INTERVAL,
    direction: 1 as const,
  };
  expect(pose(elapsed + 1, forbidden, ship.position, ship.velocity).ok).toBe(false);
  expect(world.engine.getSnapshotState().contourBridges).toHaveLength(3);

  const follower = world.join('Following pilot', { x: 0, y: 0 });
  const followerActor = world.entity(follower);
  world.engine.playerMotion.placeActorForTesting(follower.id, charged.from, now);
  followerActor.contourLock = charged.source;
  followerActor.abilityCooldownFrames = 1000;
  const epoch = followerActor.playerMotion?.epoch;
  for (let frame = 0; frame < 12; frame++) {
    world.engine.advanceOneFrame();
  }
  expect(followerActor.contourTransit).toBeUndefined();
  expect(followerActor.contourLock).toEqual(charged.target);
  expect(followerActor.position.x).toBeCloseTo(charged.to.x);
  expect(followerActor.position.y).toBeCloseTo(charged.to.y);
  expect(followerActor.contourDraftFrames).toBeGreaterThan(0);
  expect(followerActor.playerMotion?.epoch).toBeGreaterThan(epoch ?? 0);
  expect(followerActor.abilityCooldownFrames).toBe(988);
  expect(followerActor.playerMotion?.mode).toBe('free');
  const followerClient = new Player({
    id: follower.id,
    name: follower.name,
    type: 'local',
  });
  const prediction = new PlayerMotionReconciliation();
  let followerNow = world.engine.getServerTime();
  vi.spyOn(world.engine, 'getServerTime').mockImplementation(() => followerNow);
  const reconcile = () => {
    world.broadcastGameState();
    const row = world.snapshot(follower).entities.find((entity) => entity.id === follower.id);
    if (!row) {
      throw new Error('Follower missing from destination snapshot');
    }
    followerClient.updateFromServer(row);
    expect(prediction.rebase(row, followerClient.ship, followerNow)).toBe(true);
    followerClient.ship.serverOwnsMotion = prediction.shouldSuppressShipMove();
  };
  reconcile();
  expect(prediction.shouldSuppressPose()).toBe(false);
  expect(followerClient.ship.contourLock).toEqual(charged.target);
  const boostedSpeed = Math.hypot(followerClient.ship.velocity.x, followerClient.ship.velocity.y);
  for (let frame = 0; frame < CONTOUR_BRIDGE.draftFrames + 30; frame++) {
    followerNow += 1000 / 60;
    followerClient.ship.update();
    const outgoing = prediction.buildHandoffPose(followerClient.ship);
    if (!outgoing) {
      throw new Error('Follower cannot send a pose after bridge');
    }
    const accepted = world.engine.playerMotion.acceptFreePose(
      follower.socket,
      {
        epoch: outgoing.motionEpoch,
        sequence: outgoing.motionSequence,
        position: outgoing.position,
        velocity: outgoing.velocity,
        angle: outgoing.angle,
        thrusting: outgoing.thrusting,
        contourLock: outgoing.contourLock,
      },
      followerNow
    );
    expect(accepted.ok, JSON.stringify({ frame, accepted })).toBe(true);
    world.engine.advanceOneFrame(followerNow);
    reconcile();
  }
  expect(followerActor.contourDraftFrames).toBe(0);
  expect(followerClient.ship.contourDraftFrames).toBe(0);
  expect(followerActor.playerMotion?.mode).toBe('free');
  expect(Math.hypot(followerActor.velocity.x, followerActor.velocity.y)).toBeLessThan(boostedSpeed);
  followerActor.position = { ...charged.from };
  followerActor.contourLock = charged.source;
  world.engine.advanceOneFrame();
  expect(followerActor.contourTransit).toBeUndefined();
});

test.each(['damage', 'protected contact', 'impulse', 'disconnect'] as const)(
  'a bridge glide gives up motion when interrupted by %s',
  (cause) => {
    const { charged } = crewBridge();
    const follower = world.join('Interrupted follower', { x: 0, y: 0 });
    const actor = world.entity(follower);
    world.engine.playerMotion.placeActorForTesting(
      actor.id,
      charged.from,
      world.engine.getServerTime()
    );
    actor.contourLock = charged.source;
    actor.spawnProtectionTimer = cause === 'protected contact' ? 180 : 0;
    world.engine.advanceOneFrame();
    expect(actor.contourTransit).toBeDefined();
    if (cause === 'damage') {
      expect(world.engine.handleShipDamage(actor.id, 'asteroid', 25).applied).toBe(true);
    } else if (cause === 'impulse') {
      actor.position.x += 50;
      actor.velocity = { x: 2, y: 0 };
      world.engine.playerMotion.applyExternalImpulse(actor.id, world.engine.getServerTime());
    } else if (cause === 'disconnect') {
      expect(world.engine.transportClosed(follower.socket)).toBe(true);
      const resumed = world.resume(follower);
      expect(resumed.id).toBe(actor.id);
      expect(actor.playerMotion?.anchor).toEqual(actor.position);
    } else {
      world.hitAsteroid(follower);
      expect(actor.health).toBe(100);
    }
    expect(actor.contourTransit).toBeUndefined();
    const interrupted = { ...actor.position };
    for (let frame = 0; frame < CONTOUR_BRIDGE.transitFrames; frame++) {
      world.engine.advanceOneFrame();
    }
    expect(actor.contourLock).toBeNull();
    expect(actor.contourDraftFrames ?? 0).toBe(0);
    expect(actor.position).not.toEqual(charged.to);
    expect(
      Math.hypot(actor.position.x - interrupted.x, actor.position.y - interrupted.y)
    ).toBeLessThan(50);
  }
);

test.each([0, 1200])(
  'navigation salvage widens authoritative acquisition only while its %s-frame timer is active',
  (frames) => {
    const { actor, state, pose, now } = railPilot();
    const field = getTerrainField();
    const gradient = sampleGradient(field, actor.position.x, actor.position.y, 0.25);
    const magnitude = Math.hypot(gradient.x, gradient.y);
    const origin = { ...actor.position };
    let low = 0;
    let high = 54;
    for (let step = 0; step < 30; step++) {
      const distance = (low + high) / 2;
      actor.position = {
        x: origin.x + (gradient.x / magnitude) * distance,
        y: origin.y + (gradient.y / magnitude) * distance,
      };
      if (contourLockDistance(actor.position, state) > 54) {
        high = distance;
      } else {
        low = distance;
      }
    }
    expect(contourLockDistance(actor.position, state)).toBeGreaterThan(CONTOUR_LOCK.captureRadius);
    expect(contourLockDistance(actor.position, state)).toBeLessThan(60);
    world.engine.playerMotion.placeActorForTesting(actor.id, actor.position, now);
    actor.navigationAssistFrames = frames;
    expect(pose(0, state).ok).toBe(frames > 0);
  }
);

test('crew bridges cap population, refuse their owner, refresh for different followers and expire at a fixed maximum', () => {
  const { actor, state } = railPilot();
  const bridges = new CooperativeContourBridges();
  const target = { ...state, height: state.height - TERRAIN.CONTOUR_INTERVAL };
  bridges.noteHop(actor.id, actor.position, state, target, 3, 0);
  const bridge = bridges.snapshot(0)[0];
  if (!bridge) {
    throw new Error('Missing bridge fixture');
  }
  actor.contourLock = state;
  expect(bridges.catch(actor, 1)).toBeUndefined();
  for (const [index, frame] of [400, 800, 1100].entries()) {
    const follower = world.entity(world.join(`Crew ${index}`, { x: 0, y: 0 }));
    follower.position = { ...bridge.from };
    follower.contourLock = state;
    expect(bridges.catch(follower, frame)?.id).toBe(bridge.id);
    expect(bridges.catch(follower, frame)).toBeUndefined();
  }
  expect(bridges.snapshot(1199)[0]?.framesLeft).toBe(1);
  expect(bridges.snapshot(1200)).toEqual([]);
  for (let i = 0; i < CONTOUR_BRIDGE.maximum + 10; i++) {
    bridges.noteHop(actor.id, actor.position, state, target, 3, 1200);
  }
  expect(bridges.snapshot(1200)).toHaveLength(CONTOUR_BRIDGE.maximum);
  bridges.clear();
  expect(bridges.snapshot(1200)).toEqual([]);
});

test('a loaded follower leaves a crew bridge inside the cargo-adjusted draft envelope', () => {
  const { now, charged } = crewBridge();
  const follower = world.join('Loaded follower', { x: 0, y: 0 }, { kitId: 'hauler' });
  const actor = world.entity(follower);
  actor.cargo = cargoCapacity(actor.kitId);
  world.engine.playerMotion.placeActorForTesting(actor.id, charged.from, now);
  actor.contourLock = charged.source;
  for (let frame = 0; frame < CONTOUR_BRIDGE.transitFrames; frame++) {
    world.engine.advanceOneFrame();
  }
  expect(actor.contourTransit).toBeUndefined();
  expect(actor.contourLock).toEqual(charged.target);
  const speed = cruiseSpeed(
    actor.mass,
    getShipKit(actor.kitId).maxVelocity,
    actor.cargo,
    cargoCapacity(actor.kitId)
  );
  const expected = contourLockVelocity(
    actor.position,
    charged.target,
    speed * CONTOUR_BRIDGE.draftMultiplier
  );
  expect(expected).not.toBeNull();
  expect(actor.velocity.x).toBeCloseTo(expected?.x ?? NaN);
  expect(actor.velocity.y).toBeCloseTo(expected?.y ?? NaN);
});
