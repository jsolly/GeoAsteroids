/**
 * Client presentation constants. Gameplay rules the server also enforces live in
 * shared/constants/gameplay.ts.
 */

// ============================================================================
// TOUCH CONTROLS
// ============================================================================
export const TOUCH = {
  // Canvas space reserved above the ability buttons so the radar stays readable.
  ACTION_RESERVE: 112,
  PHONE_MAX_WIDTH: 500,
  PHONE_LANDSCAPE_MAX_HEIGHT: 430,
  PHONE_LANDSCAPE_MAX_WIDTH: 1000,
  TABLET_MIN_SIDE: 820,
} as const;

export const STEERING = {
  DEAD_ZONE_PX: 24,
  ARROW_DISTANCE_PX: 64,
  ARROW_LENGTH_PX: 14,
  ARROW_HALF_WIDTH_PX: 9,
} as const;

// ============================================================================
// LOCKED PLAYFIELD PALETTE
// ============================================================================
export const PALETTE = {
  BG: '#000011',
  STARS: '#8BA3C7',
  LOCAL: '#5EEAD4',
  ROID: '#94A3B8',
  /** Neutral contour ink, subdued beneath ships, lasers, and pickups. */
  CONTOUR: '#686868',
  LASER_LOCAL: '#FDE68A',
  HUD: '#E2E8F0',
  HUD_MUTED: '#64748B',
  DANGER: '#F43F5E',
  CLEARED_NEST: '#444444',
  HEALTH: '#4ADE80',
  /** Locked cream — shard pickups. Same hex as Hauler tether. */
  LOOT: '#E8D5A3',
} as const;

export const TITLE = {
  ACCENT: '#A78BFA',
} as const;

// Wave 2 feel: classic Asteroids silhouettes + Geometry Wars juice, still matt-blush.
// Ships stay hairline. Lasers / thrust / hits may bloom a little past stroke.
export const VISUAL = {
  SHIP_STROKE_WIDTH: 1.25,
  SHIP_GLOW: 1.25,
  // Round glowing balls with a bright core and no trail. LASER_LENGTH is the
  // ball diameter, sized so each halo dies before the next Scout shot.
  LASER_STROKE_WIDTH: 16,
  LASER_CORE_WIDTH: 3.5,
  LASER_CORE_COLOR: '#FFF8E1',
  LASER_LENGTH: 14,
  LASER_TRAIL_LENGTH: 0,
  LASER_EXPLODE_RADIUS: 10,
  LASER_GLOW: 2,
  LASER_HIT_TICKS: 4,
  HEALTH_CAPSULE_HEIGHT: 1.5,
  BOUNDARY_STROKE_WIDTH: 1.25,
  BOUNDARY_GLOW: 1.25,
  ROID_STROKE_COLOSSAL: 2.5,
  ROID_STROKE_LARGE: 2,
  ROID_STROKE_MEDIUM: 1.5,
  ROID_STROKE_SMALL: 1.25,
  ROID_GLOW: 2.25,
  ROID_INNER_SCALE: 0.46,
  ROID_SHATTER_MS: 280,
  ROID_SHATTER_SPREAD: 1.8,
  /** Short furnace-intake smoke; same budget as a laser shatter's hit ticks. */
  ROID_FURNACE_SMOKE_WISPS: 4,
  // Open-V thruster with a shorter inner core; flickers between two lengths.
  THRUSTER_STROKE_WIDTH: 1.25,
  THRUSTER_GLOW: 2.25,
  THRUSTER_LENGTH_RATIO: 0.68,
  THRUSTER_FLICKER_RATIO: 0.4,
  THRUSTER_CORE_RATIO: 0.42,
  THRUSTER_FLICKER_MS: 50,
  // Hearth fire is the same open-V as ship thrust, scaled to the delivery zone.
  FURNACE_STROKE_WIDTH: 1.25,
  FURNACE_GLOW: 1.4,
  FURNACE_FLAME_STROKE_WIDTH: 2,
  FURNACE_FLAME_GLOW: 3.75,
  // Hull edges pop, then drift; ring + ticks, no filled fireball.
  EXPLOSION_STROKE_WIDTH: 1.25,
  EXPLOSION_SPREAD_RATIO: 2.05,
  EXPLOSION_SPARKS: 8,
  EXPLOSION_RING_RATIO: 2.35,
  EXPLOSION_HIT_TICKS: 4,
  // Sparse world-anchored star points seeded deterministically so they never twinkle or shift.
  STAR_SIZE: 1,
  STAR_SEED: 0x9e3779b9,
  STAR_ALPHA_MIN: 0.3,
  STAR_ALPHA_MAX: 0.8,
  LOOT_STROKE_WIDTH: 2,
  LOOT_GLOW: 2,
  /** Tap canister aura is slightly larger than stroke, still hairline-adjacent. */
  TAP_LOOT_GLOW: 2.5,
  TAP_LOOT_PULSE_MS: 1200,
  LOOT_UNDERSTROKE: 3.5,
  LOOT_SHARD_INNER: 0.42,
  LOOT_SHARD_DENSE_INNER: 0.68,
  /** Positive screen-space radius keeps tiny world drops visible at deep zoom. */
  LOOT_MIN_SCREEN_PX: 5,
  MINIMAP_SIZE: 96,
  MINIMAP_DOT: 5,
  MINIMAP_LOCAL_SIZE: 6,
  MINIMAP_VOID_ALPHA: 0.5,
  MINIMAP_RING_ALPHA: 0.85,
  HUD_INSET: 16,
  HUD_BALANCE_HEIGHT: 14,
  SCORE_FONT: '14px Arial',
  NAME_LABEL_FONT: '11px Arial',
  NAME_LABEL_ALPHA: 0.4,
  // Hairline gray contours with no glow; index lines are slightly stronger.
  CONTOUR_STROKE_WIDTH: 1,
  CONTOUR_ALPHA: 0.28,
  CONTOUR_INDEX_ALPHA: 0.42,
  CONTOUR_INDEX_EVERY: 3,
  // Static title map: crop and line weights.
  TITLE_TERRAIN_GRID_SIZE: 320,
  TITLE_TERRAIN_VIEW_SPAN: 3000,
  TITLE_CONTOUR_ALPHA: 0.28,
  TITLE_CONTOUR_INDEX_ALPHA: 0.52,
  TITLE_CONTOUR_WIDTH: 0.65,
  TITLE_CONTOUR_INDEX_WIDTH: 1.1,
  TITLE_TERRAIN_INTERVAL: 0.05,
  // Neutral iso-tangent under each live shot. Terrain answers; shots stay amber on top.
  CONTOUR_LASER_LENGTH: 20,
  CONTOUR_LASER_STROKE_WIDTH: 2,
  CONTOUR_LASER_ALPHA: 0.5,
} as const;

// ============================================================================
// AUDIO CONFIGURATION
// ============================================================================
export const AUDIO = {
  CONTOUR_LOCK_ACQUIRED: ['/sounds/contour-lock-acquired.m4a', 2, 0.045],
  CONTOUR_LOCK_RELEASED: ['/sounds/contour-lock-released.m4a', 2, 0.035],
  CONTOUR_FLICK_SUCCESS: ['/sounds/contour-flick-success.m4a', 2, 0.045],
  CONTOUR_FLICK_BLOCKED: ['/sounds/contour-flick-blocked.m4a', 2, 0.035],
  CONNECTION_LOST: ['/sounds/connection-lost.m4a', 1, 0.055],
  BOOST_IGNITE: ['/sounds/boost-ignite.m4a', 3, 0.05],
  HULL_DAMAGE: ['/sounds/hull-damage.m4a', 2, 0.065],
  DELIVERY: ['/sounds/delivery.m4a', 2, 0.075],
  INTERFACE: ['/sounds/interface.m4a', 2, 0.025],
  SATELLITE_EQUIP: ['/sounds/satellite-equip.m4a', 2, 0.05],
  HARPOON_LAUNCH: ['/sounds/harpoon-launch.m4a', 4, 0.04],
  HARPOON_LATCH: ['/sounds/harpoon-latch.m4a', 4, 0.045],
  HARPOON_RELEASE: ['/sounds/harpoon-release.m4a', 3, 0.035],
  ORBITAL_PICKUP: ['/sounds/orbital-pickup.m4a', 4, 0.04],
  TAP_EJECT: ['/sounds/tap-eject.m4a', 4, 0.055],
  LOOT_PICKUP: ['/sounds/loot-pickup.m4a', 8, 0.065],
  SURVEY_SCAN: ['/sounds/survey-scan.m4a', 3, 0.035],
  RESPAWN: ['/sounds/respawn.m4a', 3, 0.035],
  ASTEROID_EXPLODE: ['/sounds/asteroid-explode.m4a', 5, 0.045],
  SATELLITE_EXPLODE: ['/sounds/satellite-explode.m4a', 4, 0.045],
  LOOT_EXPLODE: ['/sounds/loot-explode.m4a', 4, 0.04],
  // Quiet effects keep repeated combat cues comfortable.
  EXPLOSION: ['/sounds/explode.m4a', 5, 0.055],
  LASER: ['/sounds/laser.m4a', 5, 0.04],
  HIT: ['/sounds/hit.m4a', 5, 0.035],
  // Soft looping beds sit under cues; never drown crystalline SFX.
  MENU_BED_VOLUME: 0.014,
  IN_GAME_BED_VOLUME: 0.012,
  DANGER_BED_VOLUME: 0.016,
  // Missing danger-bed files keep Playfield Drift, slightly more present.
  DANGER_FALLBACK_VOLUME: 0.018,
  DANGER_FALLBACK_RATE: 1.07,
  BED_CROSSFADE_MS: 1600,
  // Audible radius used when the viewport size is unknown.
  FALLBACK_MAX_DISTANCE: 1200,
  // Floor so an on-screen source at the viewport edge stays a soft blush, not silent.
  MIN_IN_VIEWPORT_VOLUME: 0.2,
} as const;

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================
export const LOG_LEVEL_NAMES = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevelName = (typeof LOG_LEVEL_NAMES)[number];

export const LOGGING = {
  // Forward warnings/errors and selected STATE info events to the server.
  FORWARD_TO_SERVER: true,

  // Whether to write logs to browser console
  WRITE_TO_CONSOLE: true,
} as const;
