import { TOUCH, VISUAL } from '../../constants';
import { queryViewport, shouldUseTouchControls } from '../../ui/viewportChrome';

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type HudLayout = {
  padTop: number;
  padLeft: number;
  padRight: number;
  padBottom: number;
  lives: { x: number; y: number };
  score: { x: number; y: number };
  killMessageY: number;
  leaderboard: {
    x: number;
    y: number;
    width: number;
    rowHeight: number;
    maxRows: number;
  };
  miniMap: { x: number; y: number; size: number };
  overlayFontScale: number;
};

const ZERO_SAFE: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DESKTOP_EDGE = VISUAL.HUD_INSET;

export function readSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === 'undefined') {
    return { ...ZERO_SAFE };
  }
  const probe = document.getElementById('safe-area-probe');
  if (!probe) {
    return { ...ZERO_SAFE };
  }
  const style = getComputedStyle(probe);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
}

export function computeHudLayout(
  canvas: { width: number; height: number },
  options?: {
    touchControls?: boolean;
    safeArea?: SafeAreaInsets;
  }
): HudLayout {
  const safe = options?.safeArea ?? ZERO_SAFE;
  const touch =
    options?.touchControls ??
    shouldUseTouchControls({
      ...queryViewport(),
      width: canvas.width,
      height: canvas.height,
    });

  const overlayFontScale = canvas.width < 480 ? 0.62 : canvas.width < 700 ? 0.8 : 1;

  if (!touch) {
    return {
      padTop: 0,
      padLeft: 0,
      padRight: 0,
      padBottom: 0,
      lives: { x: VISUAL.HUD_INSET, y: VISUAL.HUD_INSET },
      score: { x: VISUAL.HUD_INSET, y: VISUAL.HUD_INSET },
      killMessageY: 12,
      leaderboard: {
        x: canvas.width - 180 - DESKTOP_EDGE,
        y: DESKTOP_EDGE,
        width: 180,
        rowHeight: 16,
        maxRows: 10,
      },
      miniMap: {
        x: canvas.width - DESKTOP_EDGE - VISUAL.MINIMAP_SIZE,
        y: canvas.height - DESKTOP_EDGE - VISUAL.MINIMAP_SIZE,
        size: VISUAL.MINIMAP_SIZE,
      },
      overlayFontScale,
    };
  }

  const padLeft = Math.max(12, safe.left + 8);
  const padRight = Math.max(12, safe.right + 8);
  const padTop = Math.max(12, safe.top + 8);
  const padBottom = Math.max(12, safe.bottom + 8);
  const compactHeight = canvas.height < 500;
  const boardWidth = canvas.width < 400 ? 140 : 160;
  const miniMapSize = compactHeight ? 64 : 80;

  // Compact cluster + faction + kit sit under lives; park radar below that stack.
  const miniMap = compactHeight
    ? { x: padLeft, y: padTop + VISUAL.HUD_LIFE_SIZE + 52, size: miniMapSize }
    : {
        x: canvas.width - padRight - miniMapSize,
        y: canvas.height - padBottom - TOUCH.FIRE_RESERVE - miniMapSize,
        size: miniMapSize,
      };

  return {
    padTop,
    padLeft,
    padRight,
    padBottom,
    lives: { x: padLeft, y: padTop },
    score: { x: padLeft, y: padTop },
    killMessageY: padTop,
    leaderboard: {
      x: canvas.width - boardWidth - padRight,
      y: padTop,
      width: boardWidth,
      rowHeight: 15,
      maxRows: compactHeight ? 4 : 6,
    },
    miniMap,
    overlayFontScale,
  };
}

export function hudLayoutForCanvas(canvas: { width: number; height: number }): HudLayout {
  return computeHudLayout(canvas, { safeArea: readSafeAreaInsets() });
}
