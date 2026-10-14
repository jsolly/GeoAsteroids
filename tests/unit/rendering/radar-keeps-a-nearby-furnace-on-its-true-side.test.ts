import { expect, test, vi } from 'vitest';
import { CIVIC_LOTS } from '../../../shared/furnaces';
import { WORLD } from '../../../shared/world';
import { Player } from '../../../src/entities/player/Player';

import { MINIMAP_FURNACE_MARK_SIZE } from '../../../src/rendering/hud/furnaceMapMark';
import { computeHudLayout } from '../../../src/rendering/hud/hudLayout';
import { drawMiniMap } from '../../../src/rendering/hud/minimap';

const SOUTHEAST = CIVIC_LOTS.find((lot) => lot.name === 'Southeast Furnace I');
if (!SOUTHEAST) {
  throw new Error('Southeast Furnace I is part of the furnace plan');
}

function radarCenter(layout: ReturnType<typeof computeHudLayout>): { x: number; y: number } {
  return {
    x: layout.miniMap.x + layout.miniMap.size / 2,
    y: layout.miniMap.y + layout.miniMap.size / 2,
  };
}

function foundationMarks(
  calls: ReadonlyArray<ReadonlyArray<unknown>>
): Array<{ x: number; y: number }> {
  return calls
    .filter((call) => call[2] === MINIMAP_FURNACE_MARK_SIZE)
    .map((call) => ({ x: Number(call[0]), y: Number(call[1]) }));
}

function nearestMark(
  marks: readonly { x: number; y: number }[],
  point: { x: number; y: number }
): { x: number; y: number } {
  const mark = marks.reduce((closest, candidate) =>
    Math.hypot(candidate.x - point.x, candidate.y - point.y) <
    Math.hypot(closest.x - point.x, closest.y - point.y)
      ? candidate
      : closest
  );
  return mark;
}

test('a furnace follows exact projection continuously through approach, crossing and departure', () => {
  const player = new Player({
    id: 'pilot',
    name: 'John',
    type: 'local',
  });
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Radar scenarios require a canvas context');
  }
  const arc = vi.spyOn(ctx, 'arc');
  const layout = computeHudLayout(canvas, { touchControls: false });
  const center = radarCenter(layout);
  for (const offset of [900, 220, 80, 40, 0, -40, -80, -220, -900]) {
    player.ship.position = { x: SOUTHEAST.position.x, y: SOUTHEAST.position.y + offset };
    arc.mockClear();
    drawMiniMap(ctx, layout, player.ship, [], [], [], []);
    const projected = {
      x: center.x,
      y: center.y - ((offset / WORLD.minimapRadius) * layout.miniMap.size) / 2,
    };
    const mark = nearestMark(foundationMarks(arc.mock.calls), projected);
    expect(mark.x).toBeCloseTo(projected.x, 5);
    expect(mark.y).toBeCloseTo(projected.y, 5);
  }
});

test('a furnace farther than the hull keeps its true radar position', () => {
  const player = new Player({
    id: 'pilot',
    name: 'John',
    type: 'local',
  });
  const eastOfGrate = 900;
  player.ship.position = {
    x: SOUTHEAST.position.x + eastOfGrate,
    y: SOUTHEAST.position.y - 400,
  };
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Radar scenarios require the real JSDOM canvas context');
  }
  const arc = vi.spyOn(ctx, 'arc');
  const layout = computeHudLayout(canvas, { touchControls: false });
  drawMiniMap(ctx, layout, player.ship, [], [], [], []);
  const center = radarCenter(layout);
  const half = layout.miniMap.size / 2;
  const projected = {
    x: center.x + ((SOUTHEAST.position.x - player.ship.position.x) / WORLD.minimapRadius) * half,
    y: center.y + ((SOUTHEAST.position.y - player.ship.position.y) / WORLD.minimapRadius) * half,
  };
  const mark = nearestMark(foundationMarks(arc.mock.calls), projected);
  expect(mark.x).toBeCloseTo(projected.x, 5);
  expect(mark.y).toBeCloseTo(projected.y, 5);
  expect(mark.y).not.toBeCloseTo(center.y, 0);
});
