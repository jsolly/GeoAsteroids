import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CampaignSnapshot } from '../../../shared-types';
import { entityFactory } from '../../../src/entities/EntityFactory';
import { setWorldCampaign } from '../../../src/network/worldCampaign';
import { drawCampaign } from '../../../src/rendering/campaignRenderer';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import { drawCrewSignals } from '../../../src/rendering/crewSignalRenderer';
import { setWindowViewport } from '../../support/viewport';

let restoreViewport: () => void;
beforeEach(() => {
  restoreViewport = setWindowViewport(800, 600);
  const canvas = document.createElement('canvas');
  canvas.id = 'gameCanvas';
  document.body.append(canvas);
  canvasManager.initialize(canvas);
});
afterEach(() => {
  setWorldCampaign();
  canvasManager.destroy();
  document.querySelector('#gameCanvas')?.remove();
  restoreViewport();
  vi.restoreAllMocks();
});

function campaign(): CampaignSnapshot {
  return {
    projectValue: 0,
    supplies: [],
    hives: [
      {
        kind: 'hive',
        id: 'frontier:2,0',
        position: { x: 100, y: 50 },
        frontier: 'initial',
        queenHealth: 320,
        birthFramesLeft: 480,
        clearedAt: null,
        sacs: [25, 0],
        sacDeadline: 5_000,
        sacsCompletedAt: null,
        restoredValue: 0,
        contributors: [],
        commissionedAt: null,
        shieldOpen: false,
      },
    ],
    commissioned: [],
    cleared: [],
    hazard: { phase: 'quiet', kind: 'meteors', startsAt: 0, endsAt: 0 },
    meteors: [],
  };
}

test('a shielded queen, a live sac and its deadline become an exposed queen, a ruin, then a restored furnace', () => {
  const ctx = canvasManager.requireContext();
  const labels = vi.spyOn(ctx, 'fillText');
  const arcs = vi.spyOn(ctx, 'arc');
  const sacs = vi.spyOn(ctx, 'ellipse');
  const ruins = vi.spyOn(ctx, 'strokeRect');
  const strokes: string[] = [];
  vi.spyOn(ctx, 'stroke').mockImplementation(() => {
    strokes.push(String(ctx.strokeStyle));
  });
  const state = campaign();
  const hive = state.hives[0];
  if (!hive) {
    throw new Error('Hive fixture missing');
  }
  setWorldCampaign(true, state);
  drawCampaign({ x: 0, y: 0 }, 1_000);
  expect(arcs).toHaveBeenCalledWith(500, 350, 65, 0, Math.PI * 2);
  expect(labels).toHaveBeenCalledWith('Queen 320 / 500 · shielded', 500, 255);
  expect(strokes).toContain('#af97ef');
  expect(sacs).toHaveBeenCalledTimes(1);
  expect(sacs).toHaveBeenCalledWith(725, 350, 34, 28, 0, 0, Math.PI * 2);
  expect(labels).toHaveBeenCalledWith('Sac 25 / 50', 725, 308);
  expect(labels).toHaveBeenCalledWith('Sacs regrow in 4s', 500, 460);
  labels.mockClear();
  strokes.length = 0;
  hive.shieldOpen = true;
  hive.queenHealth = 210;
  drawCampaign({ x: 0, y: 0 }, 2_000);
  expect(labels).toHaveBeenCalledWith('Queen 210 / 500 · exposed', 500, 255);
  expect(strokes).toContain('#ffad72');
  labels.mockClear();
  arcs.mockClear();
  sacs.mockClear();
  hive.clearedAt = 2_500;
  hive.sacs = [0, 0];
  hive.sacDeadline = null;
  hive.restoredValue = 1_000;
  drawCampaign({ x: 0, y: 0 }, 3_000);
  expect(arcs).not.toHaveBeenCalled();
  expect(sacs).not.toHaveBeenCalled();
  expect(ruins).toHaveBeenCalledWith(440, 290, 120, 120);
  expect(labels).toHaveBeenCalledWith('Restore · 1000 / 9600 supply', 500, 272);
  labels.mockClear();
  ruins.mockClear();
  hive.commissionedAt = 4_000;
  drawCampaign({ x: 0, y: 0 }, 4_000);
  expect(labels).not.toHaveBeenCalled();
  expect(ruins).not.toHaveBeenCalled();
});

test('a nearby meteor is painted at its world position and authoritative removal or campaign clear removes it', () => {
  const ctx = canvasManager.requireContext();
  const arcs = vi.spyOn(ctx, 'arc');
  const state = campaign();
  state.hives = [];
  state.meteors = [{ id: 'incoming-meteor', position: { x: 50, y: 70 } }];
  setWorldCampaign(true, state);
  drawCampaign({ x: 0, y: 0 }, 1_000);
  expect(arcs).toHaveBeenCalledExactlyOnceWith(450, 370, 16, 0, Math.PI * 2);
  arcs.mockClear();
  state.meteors = [];
  drawCampaign({ x: 0, y: 0 }, 2_000);
  expect(arcs).not.toHaveBeenCalled();
  state.meteors = [{ id: 'incoming-meteor', position: { x: 50, y: 70 } }];
  setWorldCampaign();
  drawCampaign({ x: 0, y: 0 }, 3_000);
  expect(arcs).not.toHaveBeenCalled();
});

test('rescue takes priority over a Help signal, edge markers clamp and sources beyond 3600 stay hidden', () => {
  const ctx = canvasManager.requireContext();
  ctx.font = '12px sans-serif';
  const labels = vi.spyOn(ctx, 'fillText');
  const arcs = vi.spyOn(ctx, 'arc');
  const expectLabelInsideViewport = () => {
    const call = labels.mock.calls[0];
    if (!call) {
      throw new Error('Missing crew label');
    }
    const [text, x, , maxWidth] = call;
    const width = Math.min(ctx.measureText(text).width, maxWidth ?? Infinity);
    expect(x - width / 2).toBeGreaterThanOrEqual(8);
    expect(x + width / 2).toBeLessThanOrEqual(792);
  };
  const pilot = entityFactory.createPlayer({
    id: 'crew',
    name: 'Mira',
    type: 'remote',
    position: { x: 1_000, y: -1_000 },
  });
  pilot.ship.downedUntil = 30_000;
  pilot.ship.crewSignal = { kind: 'help', position: { x: 10, y: 20 }, expiresAt: 30_000 };
  drawCrewSignals([pilot], { x: 0, y: 0 });
  expect(labels).toHaveBeenCalledExactlyOnceWith('Mira · rescue', expect.any(Number), 70, 784);
  expectLabelInsideViewport();
  expect(arcs).toHaveBeenCalledExactlyOnceWith(760, 40, 14, 0, Math.PI * 2);
  labels.mockClear();
  arcs.mockClear();
  pilot.ship.downedUntil = null;
  drawCrewSignals([pilot], { x: 0, y: 0 });
  expect(labels).toHaveBeenCalledExactlyOnceWith('Mira · help', 410, 350, 784);
  expectLabelInsideViewport();
  expect(arcs).toHaveBeenCalledExactlyOnceWith(410, 320, 14, 0, Math.PI * 2);
  labels.mockClear();
  arcs.mockClear();
  pilot.ship.crewSignal.position = { x: -3_600, y: 0 };
  drawCrewSignals([pilot], { x: 0, y: 0 });
  expect(labels).toHaveBeenCalledExactlyOnceWith('Mira · help', expect.any(Number), 330, 784);
  expectLabelInsideViewport();
  labels.mockClear();
  arcs.mockClear();
  pilot.ship.crewSignal.position = { x: -3_601, y: 0 };
  drawCrewSignals([pilot], { x: 0, y: 0 });
  expect(labels).not.toHaveBeenCalled();
  expect(arcs).not.toHaveBeenCalled();
  pilot.ship.crewSignal = null;
  drawCrewSignals([pilot], { x: 0, y: 0 });
  expect(labels).not.toHaveBeenCalled();
});
