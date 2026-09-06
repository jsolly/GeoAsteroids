import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('Hauler E near a rock latches and paints cream tether plus amber tip', async () => {
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
    };
  });
  expect(before.kitId).toBe('hauler');

  const latch = await page.evaluate(async () => {
    const gc = (window as { gameController?: any }).gameController;
    const player = gc?.playerManager?.getLocalPlayer?.();
    const ship = player?.ship;
    const roids = gc?.getCurrRoidBelt?.()?.getRoids?.() ?? [];
    const rock = roids[0];
    if (!ship || !rock) {
      return { ok: false, reason: 'missing ship or rock' };
    }
    // Live QA: ~280wu, KeyE — not an 80wu teleport + activateAbility() cheat.
    ship.position.x = rock.position.x - 220;
    ship.position.y = rock.position.y;
    ship.angle = 0;
    ship.abilityCooldownFrames = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    gc.updateGame(16);
    gc.renderGame();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    gc.renderGame();

    const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    const pixels = ctx && canvas ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : null;

    const nearHex = (hex: string, tolerance: number): boolean => {
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
      cream: nearHex('#E8D5A3', 22),
      tip: nearHex('#FDE68A', 22),
    };
  });

  expect(latch.ok).toBe(true);
  expect(latch.kitId).toBe('hauler');
  expect(latch.harpoonTimer).toBeGreaterThan(0);
  expect(latch.harpoonTargetId).toBeTruthy();
  expect(latch.cream).toBe(true);
  expect(latch.tip).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
