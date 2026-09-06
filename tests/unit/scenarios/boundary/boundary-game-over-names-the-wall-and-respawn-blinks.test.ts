import { describe, expect, test } from 'vitest';
import { GAME } from '../../../../src/constants';
import { Player } from '../../../../src/entities/player/Player';
import {
  applyShipBoundaryDeath,
  formatDeathCauseForOverlay,
  isShipCollisionImmune,
  resolveCombatDeathCause,
} from '../../../../src/entities/ship/shipUtils';
import { MockPlayerInput } from '../../../../src/input/MockPlayerInput';

function localPilot(): Player {
  return new Player({
    id: 'local',
    name: 'PilotB',
    type: 'local',
    input: new MockPlayerInput(),
  });
}

describe('Boundary game-over and respawn cues', () => {
  test('a hull past the arena edge is a wall death, never unknown', () => {
    expect(formatDeathCauseForOverlay('unknown')).toBeUndefined();
    expect(formatDeathCauseForOverlay('boundary')).toBe('the arena wall');
    expect(
      resolveCombatDeathCause(undefined, { position: { x: 4000, y: 0 }, r: 20 })
    ).toBe('boundary');
  });

  test('last-life wall contact flashes, explodes, and names the wall on playerDied', () => {
    const player = localPilot();
    player.lives = 1;
    player.score = 210;
    player.ship.position = { x: 4000, y: 0 };

    const deaths: Array<{ deathCause: string; isGameOver: boolean }> = [];
    const onDied = (event: Event): void => {
      deaths.push((event as CustomEvent).detail);
    };
    window.addEventListener('playerDied', onDied);

    applyShipBoundaryDeath(player.ship, 'boundary');
    player.onShipExploded({ cause: 'boundary' });
    player.updateFromServer({
      lives: 0,
      health: 0,
      exploding: true,
    });

    window.removeEventListener('playerDied', onDied);

    expect(player.ship.impactFlashFrames).toBeGreaterThan(0);
    expect(player.ship.exploding).toBe(true);
    expect(player.lives).toBe(0);
    expect(deaths).toEqual([{ playerId: 'local', deathCause: 'boundary', isGameOver: true }]);
  });

  test('a gameState life loss at the wall without a cause field is still the wall', () => {
    const player = localPilot();
    player.lives = 1;
    player.ship.position = { x: 4000, y: 0 };

    const deaths: string[] = [];
    const onDied = (event: Event): void => {
      deaths.push((event as CustomEvent).detail.deathCause);
    };
    window.addEventListener('playerDied', onDied);
    player.updateFromServer({ lives: 0, health: 0, exploding: true });
    window.removeEventListener('playerDied', onDied);

    expect(deaths).toEqual(['boundary']);
    expect(player.deathCause).toBe('boundary');
  });

  test('death then alive after a wall hit arms blink so the next graze is ignored', () => {
    const player = localPilot();
    player.lives = 2;
    player.ship.position = { x: 4000, y: 0 };
    applyShipBoundaryDeath(player.ship, 'boundary');

    player.updateFromServer({
      lives: 1,
      health: 100,
      exploding: false,
      position: { x: 200, y: 40 },
    });

    expect(player.lives).toBe(1);
    expect(player.score).toBe(GAME.STARTING_SCORE);
    expect(player.ship.health).toBe(100);
    expect(player.ship.blinkCount).toBeGreaterThan(0);
    expect(isShipCollisionImmune(player.ship)).toBe(true);
  });
});
