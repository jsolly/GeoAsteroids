import { TOUCH, VISUAL } from '../../constants';
import { queryViewport, shouldUseTouchControls } from '../../ui/viewportChrome';
import type { PlayfieldSize } from '../playfieldCamera';

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type HudLayout = {
  compact: boolean;
  padRight: number;
  balance: { x: number; y: number };
  notificationY: number;
  leaderboard: {
    x: number;
    y: number;
    width: number;
    rowHeight: number;
    maxRows: number;
  };
  miniMap: { x: number; y: number; size: number };
  kitNameY: number;
  economyBottomY: number;
};

const ZERO_SAFE: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DESKTOP_EDGE = VISUAL.HUD_INSET;

function safeAreaProbe(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('#safe-area-probe');
}

function readSafeAreaInsets(probe: HTMLElement | null): SafeAreaInsets {
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
  viewport: PlayfieldSize,
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
      width: viewport.width,
      height: viewport.height,
    });

  const hudTypeScale = touch ? (viewport.width < 480 ? 1.18 : 1.1) : 1;

  if (!touch) {
    const balance = { x: VISUAL.HUD_INSET, y: VISUAL.HUD_INSET };
    const kitNameY = balance.y + VISUAL.HUD_BALANCE_HEIGHT + 8;
    return {
      compact: false,
      padRight: 0,
      balance,
      notificationY: 12,
      leaderboard: {
        x: viewport.width - 180 - DESKTOP_EDGE,
        y: DESKTOP_EDGE,
        width: 180,
        rowHeight: 16,
        maxRows: 10,
      },
      miniMap: {
        x: viewport.width - DESKTOP_EDGE - VISUAL.MINIMAP_SIZE,
        y: viewport.height - DESKTOP_EDGE - VISUAL.MINIMAP_SIZE,
        size: VISUAL.MINIMAP_SIZE,
      },
      kitNameY,
      economyBottomY: kitNameY + 96,
    };
  }

  const padLeft = Math.max(12, safe.left + 8);
  const padRight = Math.max(12, safe.right + 8);
  const padTop = Math.max(12, safe.top + 8);
  const padBottom = Math.max(12, safe.bottom + 8);
  const compactHeight = viewport.height < 500;
  const boardWidth = Math.min(168, Math.round(viewport.width * 0.3));
  const rowHeight = compactHeight ? 16 : 18;
  const maxRows = 3;
  const miniMapSize = compactHeight ? 64 : 80;
  const balance = { x: padLeft, y: padTop };
  const kitNameY = balance.y + 20;
  const clusterClear = kitNameY + Math.round(18 * hudTypeScale);
  const miniMap = compactHeight
    ? {
        x: viewport.width - padRight - miniMapSize,
        y: viewport.height - padBottom - miniMapSize,
        size: miniMapSize,
      }
    : {
        x: viewport.width - padRight - miniMapSize,
        y: viewport.height - padBottom - TOUCH.ACTION_RESERVE - miniMapSize,
        size: miniMapSize,
      };

  return {
    compact: true,
    padRight,
    balance,
    notificationY: Math.max(clusterClear, padTop + rowHeight * maxRows) + 64,
    leaderboard: {
      x: viewport.width - boardWidth - padRight,
      y: padTop,
      width: boardWidth,
      rowHeight,
      maxRows,
    },
    miniMap,
    kitNameY,
    economyBottomY: kitNameY + 18,
  };
}

let cachedLayout:
  | {
      width: number;
      height: number;
      probe: HTMLElement | null;
      probeStyle: string | null;
      probeClass: string | null;
      layout: HudLayout;
    }
  | undefined;

/** Read browser layout at resize boundaries, rather than forcing style/media reads each frame. */
export function refreshHudLayoutForCanvas(viewport: PlayfieldSize): HudLayout {
  const probe = safeAreaProbe();
  const layout = computeHudLayout(viewport, { safeArea: readSafeAreaInsets(probe) });
  cachedLayout = {
    width: viewport.width,
    height: viewport.height,
    probe,
    probeStyle: probe?.getAttribute('style') ?? null,
    probeClass: probe?.getAttribute('class') ?? null,
    layout,
  };
  return layout;
}

export function clearHudLayoutCache(): void {
  cachedLayout = undefined;
}

export function hudLayoutForCanvas(viewport: PlayfieldSize): HudLayout {
  const probe = safeAreaProbe();
  // Inline/class changes can precede a synchronous render without a resize.
  // Attribute reads do not force style resolution on unchanged flight frames.
  if (
    cachedLayout?.width === viewport.width &&
    cachedLayout.height === viewport.height &&
    cachedLayout.probe === probe &&
    cachedLayout.probeStyle === (probe?.getAttribute('style') ?? null) &&
    cachedLayout.probeClass === (probe?.getAttribute('class') ?? null)
  ) {
    return cachedLayout.layout;
  }
  return refreshHudLayoutForCanvas(viewport);
}
