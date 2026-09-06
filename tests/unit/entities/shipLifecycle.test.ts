import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GameEngine } from '../../../server/core/GameEngine';
import { isStaleDeathPose } from '../../../server/core/EntityManager';
import { SHIP } from '../../../src/constants';
import { Player } from '../../../src/entities/player/Player';
import {
  applyShipBoundaryDeath,
  applyShipSpawnProtection,
  isServerRespawnActive,
  isShipCollisionImmune,
  isSilentHudReset,
  shouldApplyDamagedHealth,
} from '../../../src/entities/ship/shipUtils';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import { Ship } from '../../../src/entities/ship/Ship';
import { SHIP_KINDS } from '../scenarios/support/shipKinds';

describe('shared ship HUD and respawn timers', () => {
  test('respawnTimer 0 is not an active countdown', () => {
    expect(isServerRespawnActive(undefined)).toBe(false);
    expect(isServerRespawnActive(0)).toBe(false);
    expect(isServerRespawnActive(12)).toBe(true);
  });

  test('established lives/score do not snap back to a fresh spawn', () => {
    expect(isSilentHudReset(2, 210, 3, 0)).toBe(true);
    expect(isSilentHudReset(3, 210, 3, 0)).toBe(true);
    expect(isSilentHudReset(3, 0, 3, 0)).toBe(false);
    expect(isSilentHudReset(2, 210, 1, 210)).toBe(false);
    expect(isSilentHudReset(2, 210)).toBe(false);
    expect(isSilentHudReset(0, 210, 3, 0)).toBe(false);
  });

  test.each(SHIP_KINDS)('$kind explodes and flashes on a boundary hit', ({ options }) => {
    const ship = new Ship(options);
    ship.health = 100;
    applyShipBoundaryDeath(ship);
    expect(ship.health).toBe(0);
    expect(ship.exploding).toBe(true);
    expect(ship.impactFlashFrames).toBeGreaterThan(0);
  });
});

describe('shared ship collision immunity', () => {
  test('treats exploding, dead, and blinking ships as immune', () => {
    expect(isShipCollisionImmune({ exploding: true, health: 100, blinkCount: 0 })).toBe(true);
    expect(isShipCollisionImmune({ exploding: false, health: 0, blinkCount: 0 })).toBe(true);
    expect(isShipCollisionImmune({ exploding: false, health: 100, blinkCount: 3 })).toBe(true);
    expect(isShipCollisionImmune({ exploding: false, health: 100, blinkCount: 0 })).toBe(false);
  });

  test('applyShipSpawnProtection arms the same blink window for any ship', () => {
    const ship = new Ship();
    applyShipSpawnProtection(ship);
    expect(ship.blinkCount).toBe(
      Math.ceil(SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES)
    );
    expect(ship.spawnProtectionTimer).toBe(SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES);
    expect(ship.blinkOn).toBe(true);
  });

  test('playerDamaged must not raise health on ignored hits', () => {
    expect(shouldApplyDamagedHealth(0, 100, false)).toBe(false);
    expect(shouldApplyDamagedHealth(100, 100, false)).toBe(false);
    expect(shouldApplyDamagedHealth(100, 75, false)).toBe(true);
    expect(shouldApplyDamagedHealth(25, 0, true)).toBe(true);
  });
});

describe('client blink after a heal-leak', () => {
  test('updateFromServer arms blink when server still has spawn protection', () => {
    const player = new Player({
      id: 'local',
      name: 'Local',
      type: 'local',
      input: new MockPlayerInput(),
    });
    player.ship.blinkCount = 0;
    player.ship.spawnProtectionTimer = 0;
    player.ship.health = 100;
    player.ship.exploding = false;

    player.updateFromServer({
      health: 100,
      exploding: false,
      spawnProtectionTimer: 180,
    });

    expect(player.ship.blinkCount).toBeGreaterThan(0);
  });
});

describe('server ship respawn lifecycle', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(12345);
  });

  afterEach(() => {
    engine.stopGameLoop();
  });

  test('human explosion end does not reset an already-scheduled respawn timer', () => {
    const ws = {} as any;
    const player = engine.addPlayer('p1', 'Pilot', ws, { x: 0, y: 0 });
    engine.entityManager.updateEntity('p1', { spawnProtectionTimer: undefined });

    engine.handlePlayerDamage('p1', 'boundary', player.health);
    const afterDeath = engine.getPlayer('p1');
    expect(afterDeath?.respawnTimer).toBe(SHIP.RESPAWN_DELAY_FRAMES);
    expect(afterDeath?.explodeTime).toBe(SHIP.EXPLODE_DURATION_FRAMES);

    for (let i = 0; i < SHIP.EXPLODE_DURATION_FRAMES; i++) {
      engine.entityManager.updateExplosions();
      engine.entityManager.updateRespawns();
    }

    const afterExplosion = engine.getPlayer('p1');
    expect(afterExplosion?.exploding).toBe(false);
    expect(afterExplosion?.health).toBe(0);
    expect(afterExplosion?.respawnTimer).toBe(
      SHIP.RESPAWN_DELAY_FRAMES - SHIP.EXPLODE_DURATION_FRAMES
    );
  });

  test('respawn grants a full protection window and holds an anchor', () => {
    const ws = {} as any;
    const player = engine.addPlayer('p1', 'Pilot', ws, { x: 3100, y: 0 });
    engine.entityManager.updateEntity('p1', { spawnProtectionTimer: undefined });
    engine.handlePlayerDamage('p1', 'asteroid', player.health);

    for (let i = 0; i < SHIP.RESPAWN_DELAY_FRAMES; i++) {
      engine.entityManager.updateExplosions();
      engine.entityManager.updateRespawns();
    }

    const respawned = engine.getPlayer('p1');
    expect(respawned?.health).toBe(respawned?.maxHealth);
    expect(respawned?.respawnTimer).toBeUndefined();
    expect(respawned?.spawnProtectionTimer).toBe(SHIP.INVINCIBILITY_DURATION_FRAMES);
    expect(respawned?.respawnAnchor).toEqual(respawned?.position);
    expect(isStaleDeathPose(respawned?.respawnAnchor, { x: 3100, y: 0 })).toBe(true);
    expect(isStaleDeathPose(respawned?.respawnAnchor, respawned?.position)).toBe(false);
  });

  test('gameTime keeps advancing after the last player leaves', async () => {
    engine.startGameLoop();
    const ws = {} as any;
    engine.addPlayer('p1', 'Pilot', ws);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const beforeLeave = engine.getDiagnostics().gameTime;
    expect(beforeLeave).toBeGreaterThan(0);

    engine.removePlayer('p1');
    expect(engine.isGamePaused()).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 40));
    const afterLeave = engine.getDiagnostics().gameTime;
    expect(afterLeave).toBeGreaterThanOrEqual(beforeLeave);
  });
});
