import { describe, expect, test } from 'vitest';
import {
  describeDeathCause,
  formatGameOverText,
  isStaleGameOverSnapshot,
} from '../../../src/utils/deathCause';
import { GameStateManager } from '../../../src/core/services/GameStateManager';

describe('death cause attribution', () => {
  const names = new Map<string, string>([
    ['server-bot-0', 'Crimson Falcon'],
    ['client-friend', 'Nova Ranger'],
  ]);
  const resolve = (id: string) => names.get(id);

  test('maps asteroid and boundary tokens to readable phrases', () => {
    expect(describeDeathCause('asteroid', resolve)).toBe('an asteroid');
    expect(describeDeathCause('boundary', resolve)).toBe('the arena wall');
  });

  test('resolves bot and player ids to names', () => {
    expect(describeDeathCause('server-bot-0', resolve)).toBe('Crimson Falcon');
    expect(describeDeathCause('client-friend', resolve)).toBe('Nova Ranger');
  });

  test('falls back to the raw id instead of the word unknown', () => {
    expect(describeDeathCause('client-stranger', resolve)).toBe('client-stranger');
  });

  test('unknown is only used when the attacker id is missing', () => {
    expect(describeDeathCause(undefined, resolve)).toBe('unknown');
    expect(describeDeathCause('', resolve)).toBe('unknown');
  });
});

describe('game over copy', () => {
  test('omits killed-by-unknown when the cause is missing', () => {
    expect(formatGameOverText()).toBe('Game Over');
    expect(formatGameOverText('unknown')).toBe('Game Over');
  });

  test('includes a readable killer', () => {
    expect(formatGameOverText('an asteroid')).toBe('Game Over: You were killed by an asteroid');
    expect(formatGameOverText('Crimson Falcon')).toBe(
      'Game Over: You were killed by Crimson Falcon'
    );
  });
});

describe('stale game-over snapshots', () => {
  test('treats a 3-to-0 drop with full health and no cause as leftover session state', () => {
    expect(
      isStaleGameOverSnapshot({
        prevLives: 3,
        nextLives: 0,
        health: 100,
        exploding: false,
      })
    ).toBe(true);
  });

  test('does not ignore a real last-life death', () => {
    expect(
      isStaleGameOverSnapshot({
        prevLives: 1,
        nextLives: 0,
        deathCause: 'an asteroid',
        health: 0,
        exploding: true,
      })
    ).toBe(false);
    expect(
      isStaleGameOverSnapshot({
        prevLives: 1,
        nextLives: 0,
        health: 0,
        exploding: true,
      })
    ).toBe(false);
  });
});

describe('HUD overlay reset', () => {
  test('clearOverlay drops game-over text and kill banner', () => {
    const state = GameStateManager.getInstance();
    state.updateTextProperties('Game Over: You were killed by an asteroid', 1);
    state.setKillMessage('Crimson Falcon');

    state.clearOverlay();

    expect(state.getText()).toBe('');
    expect(state.getTextAlpha()).toBe(0);
    expect(state.hasKillMessage()).toBe(false);
  });
});
