import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { PALETTE } from '../../../src/constants';

const canvasSrc = readFileSync(resolve(process.cwd(), 'src/rendering/canvas.ts'), 'utf8');
const shipSrc = readFileSync(resolve(process.cwd(), 'src/entities/ship/shipRenderer.ts'), 'utf8');
const loopSrc = readFileSync(resolve(process.cwd(), 'src/core/gameController.ts'), 'utf8');

test('player and bot ships share the phosphor hull draw path', () => {
  expect(shipSrc).toMatch(/export function strokePhosphorHull/);
  expect(shipSrc).toMatch(/strokePhosphorHull\(ctx, \{ nose, rearLeft, rearRight \}, shipColor\)/);
  expect(canvasSrc).toMatch(/drawShipAtPosition\(currShip, currShip\.position, factionColor/);
  expect(canvasSrc).toMatch(/drawShipAtPosition\(player\.ship, currShip\.position, factionColor/);
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

test('play loop still advances remote lasers from the #418 MP path', () => {
  expect(loopSrc).toMatch(/advanceRemotePlayerLasers\(allPlayers\)/);
});
