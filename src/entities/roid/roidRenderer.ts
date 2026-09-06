import { PALETTE, ROID, VISUAL } from '../../constants';
import type { Ship } from '../../entities/ship/Ship';
import { isAsteroidPending, pendingElapsedMs } from '../../physics/collision/asteroidHitFeel';
import { canvasManager } from '../../rendering/canvas';
import { drawingOffsets, type PlayfieldRock } from '../../rendering/playfieldCamera';
import {
  driftSegment,
  polygonPoints,
  strokeBurstTicks,
  strokePhosphorPolyline,
  type Vec2,
} from '../../rendering/vectorJuice';

import type { Roid } from './Roid';

const zoomRockScratch: PlayfieldRock[] = [];
const roidScreen = { x: 0, y: 0 };

/** Zoom from rocks the playfield will actually stroke — not pending or NaN poses. */
export function rocksForPlayfieldZoom(roids: readonly Roid[]): PlayfieldRock[] {
  let count = 0;
  for (const roid of roids) {
    if (isAsteroidPending(roid) || !canDrawAsteroid(roid)) {
      continue;
    }
    zoomRockScratch[count] = roid;
    count += 1;
  }
  zoomRockScratch.length = count;
  return zoomRockScratch;
}

export function getRoidStrokeWidth(radius: number): number {
  if (radius >= ROID.SIZE * 0.8) {
    return VISUAL.ROID_STROKE_LARGE;
  }
  if (radius >= ROID.SIZE * 0.4) {
    return VISUAL.ROID_STROKE_MEDIUM;
  }
  return VISUAL.ROID_STROKE_SMALL;
}

/** Classic Asteroids inner facet on large rocks only — medium/small stay one outline. */
export function shouldDrawRoidInnerFacet(radius: number): boolean {
  return radius >= ROID.SIZE * 0.8;
}

/** Skip a pose that would throw during path construction and crash the frame. */
export function canDrawAsteroid(roid: {
  position: { x: number; y: number };
  r: number;
  angle: number;
  offsets: number[];
}): boolean {
  const offsets = drawingOffsets(roid.offsets);
  return (
    Number.isFinite(roid.position.x) &&
    Number.isFinite(roid.position.y) &&
    Number.isFinite(roid.r) &&
    Number.isFinite(roid.angle) &&
    Number.isFinite(offsets[0])
  );
}

function roidOutline(
  screen: Vec2,
  radius: number,
  angle: number,
  vertices: number,
  offsets: readonly number[],
  scale = 1
): Vec2[] {
  return polygonPoints(screen.x, screen.y, radius, angle, vertices, offsets, scale);
}

function drawRoidSilhouette(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  radius: number,
  inner: readonly Vec2[]
): void {
  const width = getRoidStrokeWidth(radius);
  strokePhosphorPolyline(ctx, points, PALETTE.ROID, width, VISUAL.ROID_GLOW, true);
  if (inner.length > 2) {
    strokePhosphorPolyline(
      ctx,
      inner,
      PALETTE.ROID,
      VISUAL.ROID_STROKE_SMALL,
      VISUAL.ROID_GLOW * 0.45,
      true,
      0.62
    );
  }
}

function drawRoidShatter(
  ctx: CanvasRenderingContext2D,
  origin: Vec2,
  points: readonly Vec2[],
  radius: number,
  t: number
): void {
  const alpha = 1 - t * 0.85;
  const spread = radius * VISUAL.ROID_SHATTER_SPREAD;
  ctx.save();
  ctx.strokeStyle = PALETTE.ROID;
  ctx.shadowColor = PALETTE.ROID;
  ctx.shadowBlur = VISUAL.ROID_GLOW;
  ctx.lineWidth = VISUAL.ROID_STROKE_SMALL;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) {
      continue;
    }
    const edge = driftSegment(a, b, origin, t, spread);
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.stroke();
  }
  ctx.restore();

  strokeBurstTicks(
    ctx,
    origin.x,
    origin.y,
    VISUAL.LASER_HIT_TICKS,
    t * 0.4,
    radius * (0.25 + t * 0.35),
    radius * (0.55 + t * 0.85),
    PALETTE.ROID,
    alpha,
    1,
    VISUAL.ROID_GLOW
  );
}

export function drawRoidsRelative(ship: Ship, roids: Roid[]): void {
  const ctx = canvasManager.getContext();
  const cvs = canvasManager.getCanvas();
  if (!ctx) {
    return;
  }

  const scale = canvasManager.getPlayfieldScale();
  const viewW = cvs?.width ?? Number.POSITIVE_INFINITY;
  const viewH = cvs?.height ?? Number.POSITIVE_INFINITY;

  for (const roid of roids) {
    if (!canDrawAsteroid(roid)) {
      continue;
    }

    const screenPos = canvasManager.worldToScreenInto(roidScreen, roid.position, ship.position);
    const r = roid.r * scale;
    if (screenPos.x < -r || screenPos.y < -r || screenPos.x > viewW + r || screenPos.y > viewH + r) {
      continue;
    }
    const offsets = drawingOffsets(roid.offsets);
    const vertices = Math.max(roid.vertices, 1);
    const outline = roidOutline(screenPos, r, roid.angle, vertices, offsets);

    if (isAsteroidPending(roid)) {
      const elapsed = pendingElapsedMs(roid);
      if (elapsed !== null && elapsed < VISUAL.ROID_SHATTER_MS) {
        drawRoidShatter(ctx, screenPos, outline, r, elapsed / VISUAL.ROID_SHATTER_MS);
      }
      continue;
    }

    const inner = shouldDrawRoidInnerFacet(roid.r)
      ? roidOutline(screenPos, r, roid.angle, vertices, offsets, VISUAL.ROID_INNER_SCALE)
      : [];
    drawRoidSilhouette(ctx, outline, roid.r, inner);
  }

  ctx.shadowBlur = 0;
}
