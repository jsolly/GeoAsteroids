import { expect, test } from 'vitest';

import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('mobile viewport fits chrome and shows stick + fire', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) {
    throw new Error('Page not available');
  }

  await page.setViewportSize({ width: 390, height: 844 });

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame({ waitForCombatReady: false });

  const chrome = await page.evaluate(() => {
    const root = document.getElementById('touch-controls');
    const stick = document.getElementById('touch-stick');
    const fire = document.getElementById('touch-fire');
    const canvas = document.getElementById('gameCanvas');
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const box = (el: Element | null) => {
      if (!el) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    return {
      inPlay: document.body.classList.contains('in-play'),
      touchPlay: document.body.classList.contains('touch-play'),
      hidden: root?.hidden ?? true,
      overflow,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      canvas: canvas ? { width: (canvas as HTMLCanvasElement).width, height: (canvas as HTMLCanvasElement).height } : null,
      stick: box(stick),
      fire: box(fire),
    };
  });

  expect(chrome.inPlay).toBe(true);
  expect(chrome.touchPlay).toBe(true);
  expect(chrome.hidden).toBe(false);
  expect(chrome.overflow).toBe(false);
  expect(chrome.canvas?.width).toBeGreaterThan(0);
  expect(chrome.canvas?.height).toBeGreaterThan(0);
  expect(chrome.stick).toBeTruthy();
  expect(chrome.fire).toBeTruthy();
  expect(chrome.stick?.left).toBeGreaterThanOrEqual(-1);
  expect(chrome.fire?.right).toBeLessThanOrEqual(chrome.innerWidth + 1);
  expect(chrome.stick?.bottom).toBeLessThanOrEqual(chrome.innerHeight + 1);
  expect(chrome.fire?.bottom).toBeLessThanOrEqual(chrome.innerHeight + 1);

  await page.touchscreen.tap(
    Math.round((chrome.fire?.left ?? 0) + 20),
    Math.round((chrome.fire?.top ?? 0) + 20)
  );

  const fired = await page.evaluate(() => {
    const gc = window as unknown as {
      gameController?: {
        getPlayerManager: () => {
          getLocalPlayer: () => { ship: { lasers: unknown[]; lastShotTime: number } } | null;
        };
      };
    };
    const ship = gc.gameController?.getPlayerManager().getLocalPlayer()?.ship;
    return Boolean(ship && (ship.lasers.length > 0 || ship.lastShotTime > 0));
  });
  expect(fired).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
