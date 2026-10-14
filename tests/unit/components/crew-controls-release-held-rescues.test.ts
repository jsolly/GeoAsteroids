import { flushSync, mount, unmount } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import { afterEach, expect, test, vi } from 'vitest';
import CrewControls from '../../../src/components/game/CrewControls.svelte';
import type { CrewRescueView } from '../../../src/runtime/crewRescue';

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
  await dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});
const view: CrewRescueView = {
  active: true,
  downedSeconds: null,
  target: { id: 'friend', name: 'Friend' },
  reviveSeconds: null,
  projectValue: 100,
  supplyValue: 0,
  shipmentValue: 0,
  canWithdraw: false,
  hazard: null,
};
function controls() {
  const act = vi.fn();
  const state = writable(view);
  const current = fromStore(state);
  const instance = mount(CrewControls, {
    target: document.body,
    props: {
      get view() {
        return current.current;
      },
      act,
      signal: vi.fn(),
    },
  });
  flushSync();
  dispose = () => unmount(instance);
  const button = document.querySelector('[data-revive]');
  if (!button) {
    throw new Error('Revive button missing');
  }
  return { act, button, setView: state.set };
}

test('holding the real button starts once and pointer release cancels', () => {
  const { act, button } = controls();
  button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  expect(act.mock.calls).toEqual([[{ kind: 'revive', targetId: 'friend' }]]);
  window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  expect(act.mock.calls[1]).toEqual([{ kind: 'release' }]);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  expect(act).toHaveBeenCalledTimes(2);
});

test('steering and unmount cancel activated revives', async () => {
  const { act, button } = controls();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  expect(act.mock.calls[1]).toEqual([{ kind: 'release' }]);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  flushSync();
  await dispose?.();
  dispose = undefined;
  expect(act.mock.calls.at(-1)).toEqual([{ kind: 'release' }]);
  expect(act).toHaveBeenCalledTimes(4);
});

test('click-only activation starts and cancels rescue with an accessible state', () => {
  const { act, button, setView } = controls();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  setView({ ...view, reviveSeconds: 3 });
  flushSync();
  expect(act.mock.calls).toEqual([[{ kind: 'revive', targetId: 'friend' }]]);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  expect(act).toHaveBeenCalledTimes(1);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  setView({ ...view, reviveSeconds: null });
  flushSync();
  expect(act.mock.calls.at(-1)).toEqual([{ kind: 'release' }]);
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

test('losing a rescue target releases its hold and allows a new target', () => {
  const { act, button, setView } = controls();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  flushSync();
  setView({ ...view, target: null });
  flushSync();
  expect(act.mock.calls.at(-1)).toEqual([{ kind: 'release' }]);
  setView({ ...view, target: { id: 'second', name: 'Second' } });
  flushSync();
  document
    .querySelector('[data-revive]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(act.mock.calls.at(-1)).toEqual([{ kind: 'revive', targetId: 'second' }]);
});

test('server cancellation resets the button and one activation retries the same target', () => {
  const { act, button, setView } = controls();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  setView({ ...view, reviveSeconds: 3 });
  flushSync();
  expect(button.getAttribute('aria-pressed')).toBe('true');
  // Nonlethal damage cancels the server rescue while the downed pilot remains nearby.
  setView({ ...view, reviveSeconds: null });
  flushSync();
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(button.textContent).not.toContain('Cancel');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(act.mock.calls).toEqual([
    [{ kind: 'revive', targetId: 'friend' }],
    [{ kind: 'revive', targetId: 'friend' }],
  ]);
});

test('an attempt rejected before progress remains retryable without a stale cancel', () => {
  const { act, button, setView } = controls();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  // The next authoritative view has no progress; no successful echo preceded it.
  setView({ ...view, reviveSeconds: null });
  flushSync();
  expect(button.getAttribute('aria-pressed')).toBe('false');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(act.mock.calls).toEqual([
    [{ kind: 'revive', targetId: 'friend' }],
    [{ kind: 'revive', targetId: 'friend' }],
  ]);
});
