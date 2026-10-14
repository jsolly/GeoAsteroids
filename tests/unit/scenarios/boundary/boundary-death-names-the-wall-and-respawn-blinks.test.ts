import { describe, expect, test } from 'vitest';
import { WORLD_BOUNDARY } from '../../../../shared/boundary';

import { Player } from '../../../../src/entities/player/Player';
import {
  applyShipBoundaryDeath,
  isShipCollisionImmune,
} from '../../../../src/entities/ship/shipUtils';

function localPilot(): Player {
  return new Player({ id: 'local', name: 'PilotB', type: 'local' });
}

describe('Boundary death and respawn cues', () => {
  test('wall contact flashes and explodes immediately, then adopts the authoritative respawn', () => {
    const player = localPilot();
    player.ship.position = { x: WORLD_BOUNDARY.radius + 100, y: 0 };
    applyShipBoundaryDeath(player.ship);
    expect(player.ship.impactFlashFrames).toBeGreaterThan(0);
    expect(player.ship.health).toBe(0);
    expect(player.ship.exploding).toBe(true);
    player.updateFromServer({ health: 0, exploding: true, position: { x: 0, y: 0 } });
    expect(player.ship.exploding).toBe(true);
    player.updateFromServer({ health: 100, exploding: false, position: { x: 200, y: 40 } });
    expect(player.ship.position).toEqual({ x: 200, y: 40 });
    expect(player.ship.health).toBe(100);
    expect(player.ship.blinkCount).toBeGreaterThan(0);
    expect(isShipCollisionImmune(player.ship)).toBe(true);
  });
});
