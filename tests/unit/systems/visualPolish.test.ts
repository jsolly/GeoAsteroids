import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { PALETTE } from '../../../src/constants';

const canvasSrc = readFileSync(resolve(process.cwd(), 'src/rendering/canvas.ts'), 'utf8');
const inputSrc = readFileSync(resolve(process.cwd(), 'src/core/services/InputManager.ts'), 'utf8');
const shipSrc = readFileSync(resolve(process.cwd(), 'src/entities/ship/shipRenderer.ts'), 'utf8');
const loopSrc = readFileSync(resolve(process.cwd(), 'src/core/gameController.ts'), 'utf8');
const contourSrc = readFileSync(resolve(process.cwd(), 'src/rendering/contourRenderer.ts'), 'utf8');

test('player and bot ships share the phosphor hull draw path', () => {
  expect(shipSrc).toMatch(/export function strokePhosphorPolyline/);
  expect(shipSrc).toMatch(/export function strokeKitHullOutline/);
  expect(shipSrc).toMatch(
    /strokeKitHullOutline\(ctx, screenX, screenY, shipR, ship\.angle, shipColor, ship\.kitId\)/
  );
  expect(canvasSrc).toMatch(/const ship = isLocal \? currShip : player\.ship/);
  expect(canvasSrc).toMatch(/drawShipAtPosition\(\s*ship,/);
  expect(shipSrc).toMatch(/drawSoftFactionMark\(ctx, factionId/);
  expect(shipSrc).toMatch(/park: 'hull'/);
  expect(shipSrc).toMatch(/drawPlayerName\(playerName, screenX, screenY, shipR, shipColor, factionId\)/);
  expect(canvasSrc).toMatch(/drawLootRelative/);
  expect(canvasSrc).not.toMatch(/drawBotShip|drawLocalShip|drawRemoteShip/);
});

test('shield ring is a shared phosphor stroke, not a filled disc', () => {
  const start = shipSrc.indexOf('export function drawShipShield');
  const end = shipSrc.indexOf('function drawShipImpactFlash');
  const shieldFn = shipSrc.slice(start, end);
  expect(start).toBeGreaterThan(-1);
  expect(shipSrc).toMatch(/drawShipShield\(ctx, ship, screenX, screenY, shipR\)/);
  expect(shieldFn).toMatch(/ctx\.arc\(screenX, screenY, radius/);
  expect(shieldFn).toMatch(/PALETTE\.SHIELD/);
  expect(shieldFn).not.toMatch(/\.fill\(/);
});

test('live ship and laser strokes never use white', () => {
  expect(PALETTE.LOCAL.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.REMOTE.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.BOT.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.LASER_LOCAL).toBe('#FDE68A');
  expect(PALETTE.LASER_ENEMY.toLowerCase()).not.toBe('#ffffff');
  expect(shipSrc).toMatch(/strokePhosphorSegment/);
  expect(shipSrc).toMatch(/VISUAL\.LASER_LENGTH/);
  expect(shipSrc).toMatch(/drawGenericThruster/);
  expect(shipSrc).not.toMatch(/#fff|#ffffff|#FFFFFF/i);
});

test('play loop ticks remote ships on the shared 60 Hz lifecycle clock', () => {
  expect(loopSrc).toMatch(/advanceRemotePlayerShips\(allPlayers, lifecycleFrames\)/);
});

test('iso contours stay muted hairlines with no phosphor bloom', () => {
  expect(PALETTE.CONTOUR).toBe('#334155');
  expect(contourSrc).toMatch(/VISUAL\.CONTOUR_STROKE_WIDTH/);
  expect(contourSrc).toMatch(/shadowBlur = 0/);
  expect(contourSrc).not.toMatch(/shadowBlur = [1-9]/);
  expect(canvasSrc).toMatch(/drawIsoContours\(currShip\.position\)/);
});

test('play canvas and mouse input bind to #gameCanvas, not the title starfield', () => {
  expect(canvasSrc).toMatch(/getElementById\('gameCanvas'\)/);
  expect(inputSrc).toMatch(/getElementById\('gameCanvas'\)/);
  expect(canvasSrc).not.toMatch(/querySelector\('canvas'\)/);
  expect(inputSrc).not.toMatch(/querySelector\('canvas'\)/);
});
