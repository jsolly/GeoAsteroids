import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GameController } from '../../../../src/core/gameController';
import { GameStateManager } from '../../../../src/core/services/GameStateManager';
import { PlayerManager } from '../../../../src/entities/player/PlayerManager';
import { toggleScreen } from '../../../../src/ui/uiUtils';
import { GAME } from '../../../../src/constants';
import {
  GameServerWorld,
  useQuietServerConsole,
  type Pilot,
} from '../support/gameServerWorld';

useQuietServerConsole();

/** Overlay time in `GameController.gameOver` — long enough to read, not a stall. */
const GAME_OVER_OVERLAY_MS = 3500;

describe('Game-over returns to the menu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    GameStateManager.getInstance().setIsGameRunning(true);
    GameStateManager.getInstance().updateTextProperties('', 1);
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    GameStateManager.getInstance().setIsGameRunning(false);
    GameStateManager.getInstance().updateTextProperties('', 1);
  });

  test('a known killer is shown — never "unknown"', () => {
    const controller = GameController.getInstance();
    controller.gameOver('the arena wall');

    const text = GameStateManager.getInstance().getText();
    expect(text).toBe('Game Over: You were killed by the arena wall');
    expect(text.toLowerCase()).not.toContain('unknown');
  });

  test('omitting a cause says Game Over, not killed-by-unknown', () => {
    GameController.getInstance().gameOver();

    const text = GameStateManager.getInstance().getText();
    expect(text).toBe('Game Over');
    expect(text.toLowerCase()).not.toContain('unknown');
  });

  test('the menu comes back after the short overlay, not a long stall', async () => {
    GameController.getInstance().gameOver('boundary');

    expect(GameStateManager.getInstance().getIsGameRunning()).toBe(true);
    expect(document.getElementById('gameArea')?.style.display).not.toBe('none');

    await vi.advanceTimersByTimeAsync(GAME_OVER_OVERLAY_MS);

    expect(GameStateManager.getInstance().getIsGameRunning()).toBe(false);
    expect(document.getElementById('start-screen')?.style.display).toBe('block');
    expect(document.getElementById('gameArea')?.style.display).toBe('none');
  });

  test('a final death event with a real cause does not become unknown', () => {
    const controller = GameController.getInstance();
    controller.newGame('Ace');
    const local = PlayerManager.getInstance().getLocalPlayer();
    expect(local).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent('playerDied', {
        detail: { playerId: local!.id, deathCause: 'boundary', isGameOver: true },
      })
    );

    const text = GameStateManager.getInstance().getText();
    expect(text).toBe('Game Over: You were killed by boundary');
    expect(text.toLowerCase()).not.toContain('unknown');
  });
});

describe('Last life on the server', () => {
  let world: GameServerWorld;
  let ace: Pilot;

  beforeEach(() => {
    world = new GameServerWorld();
    ace = world.join('Ace');
    world.wearOffJoinInvulnerability();
    world.entity(ace).lives = 1;
  });

  afterEach(() => {
    world.dispose();
  });

  test('the killing blow spends the last life and names the attacker', () => {
    world.hitBoundary(ace);

    expect(world.entity(ace).lives).toBe(0);
    expect(world.entity(ace).health).toBe(0);
    expect(world.entity(ace).exploding).toBe(true);
    expect(ace.socket.lastReceived('playerKilled')?.data).toMatchObject({
      targetPlayerId: ace.id,
      attackerId: 'boundary',
    });
    expect(ace.socket.lastReceived('playerKilled')?.data).not.toMatchObject({
      attackerId: 'unknown',
    });
    expect(GAME.START_LIVES).toBe(3);
  });
});
