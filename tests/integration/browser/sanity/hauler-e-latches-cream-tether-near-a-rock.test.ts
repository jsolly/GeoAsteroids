import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('Hauler menu kit survives join, KeyE near a rock latches cream+tip', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame({ waitForCombatReady: false, kitId: 'hauler' });

  const before = await page.evaluate(() => {
    const gc = (window as { gameController?: any }).gameController;
    const player = gc?.playerManager?.getLocalPlayer?.();
    return {
      kitId: player?.ship?.kitId,
      selected: document.querySelector('[data-kit-id="hauler"]')?.getAttribute('aria-pressed'),
      joined: Boolean(gc?.getNetworkManager?.()?.getLocalPlayerId?.()),
    };
  });
  expect(before.kitId).toBe('hauler');
  expect(before.selected).toBe('true');
  expect(before.joined).toBe(true);

  const approached = await page.evaluate(async () => {
    const gc = (window as { gameController?: any }).gameController;
    const ship = gc?.playerManager?.getLocalPlayer?.()?.ship;
    const roids = gc?.getCurrRoidBelt?.()?.getRoids?.() ?? [];
    if (!ship || !roids.length) {
      return { ok: false, reason: 'missing ship or rock' };
    }
    const rock = roids
      .map((candidate: { position: { x: number; y: number }; r?: number; id?: string }) => ({
        candidate,
        dist: Math.hypot(
          candidate.position.x - ship.position.x,
          candidate.position.y - ship.position.y
        ),
      }))
      .sort(
        (
          a: { dist: number },
          b: { dist: number }
        ) => a.dist - b.dist
      )[0]?.candidate;
    if (!rock) {
      return { ok: false, reason: 'no rock' };
    }
    const dx = rock.position.x - ship.position.x;
    const dy = rock.position.y - ship.position.y;
    ship.angle = Math.atan2(-dy, dx);
    ship.thrusting = true;
    const start = performance.now();
    while (performance.now() - start < 1200) {
      const gap =
        Math.hypot(rock.position.x - ship.position.x, rock.position.y - ship.position.y) -
        (ship.r ?? 0) -
        (rock.r ?? 0);
      if (gap < 90) {
        break;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    ship.thrusting = false;
    ship.abilityCooldownFrames = 0;
    const dist = Math.hypot(rock.position.x - ship.position.x, rock.position.y - ship.position.y);
    return {
      ok: true,
      kitId: ship.kitId,
      dist,
      gap: dist - (ship.r ?? 0) - (rock.r ?? 0),
      rockId: rock.id ?? null,
    };
  });
  expect(approached.ok).toBe(true);
  expect(approached.kitId).toBe('hauler');

  const latch = await page.evaluate(async () => {
    const gc = (window as { gameController?: any }).gameController;
    const ship = gc?.playerManager?.getLocalPlayer?.()?.ship;
    if (!ship) {
      return { ok: false, reason: 'no ship' };
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    gc.updateGame(16);
    gc.renderGame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    gc.renderGame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    gc.renderGame();

    const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    const pixels = ctx && canvas ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : null;
    const scan = (hex: string, tolerance: number): boolean => {
      if (!pixels) {
        return false;
      }
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          Math.abs((pixels[i] ?? 0) - r) <= tolerance &&
          Math.abs((pixels[i + 1] ?? 0) - g) <= tolerance &&
          Math.abs((pixels[i + 2] ?? 0) - b) <= tolerance &&
          (pixels[i + 3] ?? 0) > 180
        ) {
          return true;
        }
      }
      return false;
    };

    return {
      ok: true,
      kitId: ship.kitId,
      harpoonTargetId: ship.harpoonTargetId ?? null,
      harpoonTimer: ship.harpoonTimer,
      abilityActiveFrames: ship.abilityActiveFrames,
      latchPos: ship.harpoonLatchPos ?? null,
      cream: scan('#E8D5A3', 22),
      tip: scan('#FDE68A', 22),
    };
  });

  expect(latch.ok).toBe(true);
  expect(latch.kitId).toBe('hauler');
  expect(latch.harpoonTimer).toBeGreaterThan(0);
  expect(latch.harpoonTargetId || latch.latchPos).toBeTruthy();
  expect(latch.cream).toBe(true);
  expect(latch.tip).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
