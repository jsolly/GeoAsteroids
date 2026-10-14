import { afterEach, expect, test, vi } from 'vitest';
import { Player } from '../../../src/entities/player/Player';
import { Ship } from '../../../src/entities/ship/Ship';
import { drawHullAssembly } from '../../../src/entities/ship/shipRenderer';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('deployment edges converge to the hull and finish without touching flight state', () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas required');
  }
  const ship = new Ship({ position: { x: 80, y: 90 } });
  ship.hullAssemblyStartedAt = 100;
  const lines = vi.spyOn(ctx, 'lineTo');
  expect(drawHullAssembly(ctx, ship, 200, 200, 10, 0, '#fff', 100)).toBe(true);
  const early = lines.mock.calls.map(([x, y]) => Math.hypot(x - 200, y - 200));
  lines.mockClear();
  expect(drawHullAssembly(ctx, ship, 200, 200, 10, 0, '#fff', 790)).toBe(true);
  const late = lines.mock.calls.map(([x, y]) => Math.hypot(x - 200, y - 200));
  expect(early.length).toBe(late.length);
  expect(Math.max(...early)).toBeGreaterThan(Math.max(...late) + 15);
  expect(drawHullAssembly(ctx, ship, 200, 200, 10, 0, '#fff', 800)).toBe(false);
  expect(ship.position).toEqual({ x: 80, y: 90 });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  expect(drawHullAssembly(ctx, ship, 200, 200, 10, 0, '#fff', 100)).toBe(false);
});

test('accepted respawn starts assembly once and healthy snapshot repeats do not restart it', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(100);
  const player = new Player({
    id: 'pilot',
    name: 'Pilot',
    type: 'remote',
    input: new MockPlayerInput(),
  });
  player.updateFromServer({ position: { x: 0, y: 0 }, health: 100, spawnProtectionTimer: 120 });
  expect(player.ship.hullAssemblyStartedAt).toBe(100);
  now.mockReturnValue(300);
  player.updateFromServer({ position: { x: 0, y: 0 }, health: 100, spawnProtectionTimer: 100 });
  expect(player.ship.hullAssemblyStartedAt).toBe(100);
  player.updateFromServer({ health: 0, exploding: true });
  now.mockReturnValue(1000);
  player.updateFromServer({
    position: { x: 180, y: 0 },
    health: 100,
    exploding: false,
    respawnTimer: 0,
    spawnProtectionTimer: 120,
  });
  expect(player.ship.hullAssemblyStartedAt).toBe(1000);
});
