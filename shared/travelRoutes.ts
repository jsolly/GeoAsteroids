import type { Position } from '../shared-types';
import type { Heightfield } from './heightfield';
import { PASSAGES, passageAxis, passagePhase, passageStrength } from './passages';

/** Reuse the terrain generator's two warped corridor families, with no world-sized route list. */
export function onTravelRoute(field: Heightfield, position: Position): boolean {
  return passageStrength(field, position.x, position.y) >= 0.45;
}

export function nearbyRouteWaypoints(
  field: Heightfield,
  viewer: Position
): Array<{ id: string; position: Position }> {
  const points: Array<{ id: string; position: Position }> = [];
  const spacing = PASSAGES.SPACING;
  const phase = passagePhase(field.seed);
  for (const orientation of ['horizontal', 'vertical'] as const) {
    const along = orientation === 'horizontal' ? viewer.x - field.cx : viewer.y - field.cy;
    const across = orientation === 'horizontal' ? viewer.y - field.cy : viewer.x - field.cx;
    const segment = Math.round(along / spacing);
    for (let i = segment - 1; i <= segment + 1; i++) {
      const coordinate = i * spacing;
      const offset =
        passageAxis(coordinate, phase + (orientation === 'vertical' ? PASSAGES.VERTICAL_PHASE : 0))
          .offset +
        (orientation === 'horizontal' ? PASSAGES.HORIZONTAL_OFFSET : PASSAGES.VERTICAL_OFFSET);
      const lane = Math.round((across - offset) / spacing);
      const position =
        orientation === 'horizontal'
          ? { x: coordinate + field.cx, y: lane * spacing + offset + field.cy }
          : { x: lane * spacing + offset + field.cx, y: coordinate + field.cy };
      if (
        onTravelRoute(field, position) &&
        Math.hypot(position.x - viewer.x, position.y - viewer.y) < spacing * 1.5
      ) {
        points.push({ id: `${orientation}:${i}:${lane}`, position });
      }
    }
  }
  return points;
}
