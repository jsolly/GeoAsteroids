import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { Laser } from '../../../src/entities/laser/Laser';
import { createPlayer } from '../../../src/entities/player/createPlayer';
import { PlayerManager } from '../../../src/entities/player/PlayerManager';
import { RoidBelt } from '../../../src/entities/roid/Roid';
import { ConnectionManager } from '../../../src/network/services/ConnectionManager';
import { drawGame } from '../../../src/rendering/canvas';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import * as contourLasers from '../../../src/rendering/contourLaserRenderer';

import { TestPath2D } from '../../support/TestPath2D';

beforeAll(() => {
  const network = ConnectionManager.getInstance();
  PlayerManager.getInstance({ networkPort: network, combatNetwork: network.combatNetwork });
});

afterEach(() => {
  canvasManager.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('successive frames reuse shot sources and remove a departed pilot without retaining their lasers', () => {
  vi.stubGlobal('Path2D', TestPath2D);
  canvasManager.initialize(document.querySelector<HTMLCanvasElement>('#gameCanvas'));
  const local = PlayerManager.getInstance().createLocalPlayer();
  local.id = 'local-pilot';
  local.ship.position = { x: 0, y: 0 };
  const first = createPlayer({
    id: 'first-pilot',
    name: 'First',
    type: 'remote',
    position: { x: 100, y: 0 },
  });
  const second = createPlayer({
    id: 'second-pilot',
    name: 'Second',
    type: 'remote',
    position: { x: 200, y: 0 },
  });
  const shot = (x: number) => new Laser({ x, y: 40 }, { x: 1, y: 0 }, 0, 0);
  local.ship.lasers = [shot(10)];
  first.ship.lasers = [shot(110)];
  second.ship.lasers = [shot(210)];
  let players = [local, first, second];
  const network = ConnectionManager.getInstance();
  vi.spyOn(network, 'getLocalPlayerId').mockReturnValue(local.id);
  vi.spyOn(network, 'getAllPlayers').mockImplementation(() => players);
  const collect = vi.spyOn(contourLasers, 'liveLaserPositions');
  const paint = vi.spyOn(contourLasers, 'drawContourLaserTicks');
  const belt = new RoidBelt();
  const draw = () => drawGame(local, belt, players);
  const observedPositions = () => paint.mock.calls.at(-1)?.[1].map(({ x, y }) => ({ x, y }));

  draw();
  const sources = [...(collect.mock.calls.at(-1)?.[0] ?? [])];
  expect(sources).toHaveLength(3);
  expect(observedPositions()).toEqual([
    { x: 10, y: 40 },
    { x: 110, y: 40 },
    { x: 210, y: 40 },
  ]);

  second.ship.lasers = [shot(220)];
  draw();
  expect(collect.mock.calls.at(-1)?.[0][1]).toBe(sources[1]);
  expect(collect.mock.calls.at(-1)?.[0][2]).toBe(sources[2]);
  expect(observedPositions()).toEqual([
    { x: 10, y: 40 },
    { x: 110, y: 40 },
    { x: 220, y: 40 },
  ]);

  players = [local, second];
  draw();
  expect(collect.mock.calls.at(-1)?.[0]).toHaveLength(2);
  expect(observedPositions()).toEqual([
    { x: 10, y: 40 },
    { x: 220, y: 40 },
  ]);
});
