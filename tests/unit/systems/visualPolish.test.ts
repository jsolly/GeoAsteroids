import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { PALETTE } from '../../../src/constants';

const canvasSrc = readFileSync(resolve(process.cwd(), 'src/rendering/canvas.ts'), 'utf8');
const inputSrc = readFileSync(resolve(process.cwd(), 'src/core/services/InputManager.ts'), 'utf8');
const shipSrc = readFileSync(resolve(process.cwd(), 'src/entities/ship/shipRenderer.ts'), 'utf8');
const loopSrc = readFileSync(resolve(process.cwd(), 'src/core/gameController.ts'), 'utf8');

test('player and bot ships share the phosphor hull draw path', () => {
  expect(shipSrc).toMatch(/export function strokePhosphorPolyline/);
  expect(shipSrc).toMatch(/export function strokeKitHullOutline/);
  expect(shipSrc).toMatch(/strokeKitHullOutline\(ctx, screenX, screenY, shipR, ship\.angle, shipColor, ship\.kitId\)/);
  expect(canvasSrc).toMatch(/drawShipAtPosition\(\s*currShip,\s*currShip\.position,\s*ownerColor/);
  expect(canvasSrc).toMatch(/drawShipAtPosition\(\s*player\.ship,\s*currShip\.position,\s*ownerColor/);
  expect(shipSrc).toMatch(/drawSoftFactionMark\(ctx, factionId/);
  expect(canvasSrc).not.toMatch(/drawBotShip|drawLocalShip|drawRemoteShip/);
});

test('live ship and laser strokes never use white', () => {
  expect(PALETTE.LOCAL.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.REMOTE.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.BOT.toLowerCase()).not.toBe('#ffffff');
  expect(PALETTE.LASER_LOCAL).toBe('#FDE68A');
  expect(PALETTE.LASER_ENEMY.toLowerCase()).not.toBe('#ffffff');
  expect(shipSrc).toMatch(/strokePhosphorSegment/);
  expect(shipSrc).toMatch(/VISUAL\.LASER_LENGTH/);
});

test('play loop ticks remote ships on the shared 60 Hz lifecycle clock', () => {
  expect(loopSrc).toMatch(/advanceRemotePlayerShips\(allPlayers, lifecycleFrames\)/);
});

test('play canvas and mouse input bind to #gameCanvas, not the title starfield', () => {
  expect(canvasSrc).toMatch(/getElementById\('gameCanvas'\)/);
  expect(inputSrc).toMatch(/getElementById\('gameCanvas'\)/);
  expect(canvasSrc).not.toMatch(/querySelector\('canvas'\)/);
  expect(inputSrc).not.toMatch(/querySelector\('canvas'\)/);
});
