import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import {
  getKitHullOutline,
  HULL_SVG_PACK_DIR,
  kitHullSvgFileName,
  listKitHullOutlines,
  projectHullPoint,
  serializeKitHullSvg,
} from '../../../src/entities/ship/hullOutlines';
import {
  AD_V2_HULL_BAKE_LOCKED,
  AD_V2_HULL_SHEET,
  AD_V2_HULL_TOPOLOGY,
  KIT_HULLS_ARE_PLACEHOLDERS,
  SHIP_KIT_IDS,
} from '../../../src/entities/ship/shipKits';

test('AD v2 hull bake is locked and no longer a shared placeholder', () => {
  expect(AD_V2_HULL_BAKE_LOCKED).toBe(true);
  expect(KIT_HULLS_ARE_PLACEHOLDERS).toBe(false);
  expect(AD_V2_HULL_SHEET.playScalePx).toBe(32);
  expect(AD_V2_HULL_SHEET.stroke).toBe('#5EEAD4');
  expect(AD_V2_HULL_SHEET.sheets).toEqual([
    'ship-silhouettes-contact-v2',
    'ship-silhouettes-play-scale-v2',
  ]);
});

test('each kit bakes a unique v2 topology', () => {
  const outlines = listKitHullOutlines();
  expect(outlines.map((outline) => outline.kitId)).toEqual([...SHIP_KIT_IDS]);
  expect(new Set(outlines.map((outline) => outline.topology)).size).toBe(5);
  expect(AD_V2_HULL_TOPOLOGY).toEqual({
    dart: 'needle',
    hauler: 'barge-hex',
    warden: 'delta-shield-arc',
    skirmisher: 'y-fork',
    quake: 'terraced-mountain',
  });
  const fingerprints = outlines.map((outline) =>
    outline.hull.points.map((point) => `${point.f}:${point.p}`).join('|')
  );
  expect(new Set(fingerprints).size).toBe(5);
});

test('Dart needle is a four-point isosceles with an inverted-V aft notch', () => {
  const dart = getKitHullOutline('dart');
  expect(dart.topology).toBe('needle');
  expect(dart.hull.points).toHaveLength(4);
  const minF = Math.min(...dart.hull.points.map((point) => point.f));
  const wings = dart.hull.points.filter((point) => point.f === minF);
  expect(wings).toHaveLength(2);
  const notch = dart.hull.points.find((point) => point.p === 0 && point.f > minF && point.f < 0);
  expect(notch).toBeTruthy();
});

test('Hauler barge hex is squat with a pointed bow, vertical sides, and a flat keel', () => {
  const hauler = getKitHullOutline('hauler');
  expect(hauler.topology).toBe('barge-hex');
  const minF = Math.min(...hauler.hull.points.map((point) => point.f));
  const maxF = Math.max(...hauler.hull.points.map((point) => point.f));
  const maxP = Math.max(...hauler.hull.points.map((point) => Math.abs(point.p)));
  const keel = hauler.hull.points.filter((point) => point.f === minF);
  expect(keel).toHaveLength(2);
  const bow = hauler.hull.points.reduce((best, point) => (point.f > best.f ? point : best));
  expect(bow.p).toBe(0);
  expect(maxP * 2).toBeGreaterThan(maxF - minF);
  const vertical = [...new Set(hauler.hull.points.map((point) => point.p))].filter(
    (p) => hauler.hull.points.filter((point) => point.p === p).length >= 2
  );
  expect(vertical.length).toBeGreaterThanOrEqual(2);
});

test('Warden is a notched delta with a detached forward shield arc', () => {
  const warden = getKitHullOutline('warden');
  expect(warden.topology).toBe('delta-shield-arc');
  expect(warden.hull.points).toHaveLength(4);
  const minF = Math.min(...warden.hull.points.map((point) => point.f));
  const aft = warden.hull.points.filter((point) => point.f === minF);
  expect(aft).toHaveLength(2);
  const notch = warden.hull.points.find((point) => point.p === 0 && point.f > minF && point.f < 0);
  expect(notch).toBeTruthy();
  expect(warden.extras).toHaveLength(1);
  const arc = warden.extras[0];
  expect(arc?.closed).toBe(false);
  const apex = warden.hull.points.reduce((best, point) => (point.f > best.f ? point : best));
  const arcMinF = Math.min(...(arc?.points.map((point) => point.f) ?? []));
  expect(arcMinF).toBeGreaterThan(apex.f);
});

test('Skirmisher is a Y-fork with vertical prongs and a pointed aft', () => {
  const skirmisher = getKitHullOutline('skirmisher');
  expect(skirmisher.topology).toBe('y-fork');
  const tips = skirmisher.hull.points.filter((point) => point.f > 1);
  expect(tips).toHaveLength(2);
  expect(tips.every((tip) => Math.abs(tip.p) > 0.3)).toBe(true);
  expect(tips[0] && tips[1] && tips[0].f === tips[1].f).toBe(true);
  const valley = skirmisher.hull.points.find(
    (point) => point.p === 0 && point.f > 0 && point.f < 0.2
  );
  expect(valley).toBeTruthy();
  const vertical = tips.filter((tip) =>
    skirmisher.hull.points.some((point) => point.p === tip.p && point.f < tip.f)
  );
  expect(vertical).toHaveLength(2);
});

test('Quake is a terraced mountain with a triangular peak', () => {
  const quake = getKitHullOutline('quake');
  expect(quake.topology).toBe('terraced-mountain');
  const peak = quake.hull.points.reduce((best, point) => (point.f > best.f ? point : best));
  expect(peak.p).toBe(0);
  const terraceFs = [...new Set(quake.hull.points.map((point) => point.f))].filter(
    (f) => quake.hull.points.filter((point) => point.f === f).length >= 2
  );
  expect(terraceFs.length).toBeGreaterThanOrEqual(3);
});

test('v2 SVG pack matches the outline bake and names no v1 sheets', () => {
  for (const outline of listKitHullOutlines()) {
    const fileName = kitHullSvgFileName(outline.kitId);
    const onDisk = readFileSync(resolve(process.cwd(), HULL_SVG_PACK_DIR, fileName), 'utf8');
    expect(onDisk).toBe(serializeKitHullSvg(outline.kitId));
    expect(onDisk).toContain(outline.topology);
    expect(onDisk).not.toMatch(/v1/i);
    expect(onDisk).toContain('#5EEAD4');
    expect(onDisk).toContain('#000011');
  }
});

test('local-space projection matches the classic triangle helper axes', () => {
  const nose = projectHullPoint(0, 0, 10, 0, { f: 1, p: 0 });
  expect(nose).toEqual({ x: 10, y: 0 });
  const rearLeft = projectHullPoint(0, 0, 10, 0, { f: -0.8, p: 0.5 });
  expect(rearLeft).toEqual({ x: -8, y: 5 });
});
