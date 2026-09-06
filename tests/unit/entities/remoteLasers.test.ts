import { expect, test, vi } from 'vitest';
import { Laser } from '../../../src/entities/laser/Laser';
import { Player } from '../../../src/entities/player/Player';
import { advanceRemotePlayerLasers } from '../../../src/entities/player/remoteLasers';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import { canvasManager } from '../../../src/rendering/canvas';

function makePlayer(type: 'local' | 'remote' | 'bot'): Player {
  return new Player({ id: type, name: type, type, input: new MockPlayerInput() });
}

test('advances lasers only for remote players', () => {
  const remote = makePlayer('remote');
  const local = makePlayer('local');
  const bot = makePlayer('bot');

  const remoteSpy = vi.spyOn(remote.ship, 'moveLasers');
  const localSpy = vi.spyOn(local.ship, 'moveLasers');
  const botSpy = vi.spyOn(bot.ship, 'moveLasers');

  advanceRemotePlayerLasers([remote, local, bot]);

  expect(remoteSpy).toHaveBeenCalledTimes(1);
  expect(localSpy).not.toHaveBeenCalled();
  expect(botSpy).not.toHaveBeenCalled();
});

test("a remote player's laser travels instead of freezing at the muzzle", () => {
  // Provide a canvas so lasers do not immediately expire (isExpired needs one).
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  canvasManager.initialize();

  const remote = makePlayer('remote');
  remote.ship.lasers.push(new Laser({ x: 0, y: 0 }, { x: 5, y: 0 }, 0, 0, false));

  advanceRemotePlayerLasers([remote]);

  expect(remote.ship.lasers.length).toBe(1);
  expect(remote.ship.lasers[0]?.position.x).toBeCloseTo(5, 5);

  canvas.remove();
});
