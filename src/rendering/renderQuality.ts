type DprLimit = 'native' | 0.75 | 1 | 1.5 | 2;
type Glow = 'full' | 'off';

type RenderQuality = Readonly<{
  maxDpr: DprLimit;
  glow: Glow;
  source: 'desktop-default' | 'touch-default' | 'diagnostic';
}>;

// Flight remains native/full; low-end Scan has its own bounded presentation policy.
// See docs/performance/mobile-quality-decisions.md for measured scope and tradeoffs.
const FULL_QUALITY = Object.freeze({ maxDpr: 'native', glow: 'full' } as const);
const TOUCH_PRESET = FULL_QUALITY;
let activeQuality: RenderQuality = { ...FULL_QUALITY, source: 'desktop-default' };

/** Shared by the client and manual benchmark so a requested cap cannot silently differ. */
export function parseRenderDprLimit(value: string): DprLimit {
  switch (value) {
    case 'native':
      return 'native';
    case '0.75':
      return 0.75;
    case '1':
      return 1;
    case '1.5':
      return 1.5;
    case '2':
      return 2;
    default:
      throw new Error('renderDpr must be native, 2, 1.5, 1, or 0.75');
  }
}

/** Resolve once at the canvas resize/session boundary, never inside a drawing loop. */
export function configureRenderQuality(search: string, touchControls: boolean): RenderQuality {
  const params = new URLSearchParams(search);
  const diagnostic = ['1', 'collect'].includes(params.get('performance') ?? '');
  const defaults = touchControls ? TOUCH_PRESET : FULL_QUALITY;
  let maxDpr: DprLimit = defaults.maxDpr;
  let glow: Glow = defaults.glow;
  const dprOverride = diagnostic ? params.get('renderDpr') : null;
  const glowOverride = diagnostic ? params.get('renderGlow') : null;
  if (dprOverride !== null) {
    maxDpr = parseRenderDprLimit(dprOverride);
  }
  if (glowOverride !== null) {
    if (glowOverride !== 'full' && glowOverride !== 'off') {
      throw new Error('renderGlow must be full or off');
    }
    glow = glowOverride;
  }
  activeQuality = Object.freeze({
    maxDpr,
    glow,
    source:
      dprOverride !== null || glowOverride !== null
        ? 'diagnostic'
        : touchControls
          ? 'touch-default'
          : 'desktop-default',
  });
  return activeQuality;
}

/** Cosmetic blur only: geometry, color, core strokes, and timing are unaffected. */
export function resolveGlow(blur: number): number {
  return activeQuality.glow === 'off' ? 0 : blur;
}
