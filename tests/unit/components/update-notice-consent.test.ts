import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, test, vi } from 'vitest';
import UpdateNotice from '../../../src/components/UpdateNotice.svelte';

const release = vi.hoisted(() => ({
  announce: (_release: string | null, _stale: boolean) => {},
  stop: vi.fn(),
  reload: vi.fn().mockResolvedValue({ kind: 'reloading' }),
}));
vi.mock('../../../src/release/clientReleaseEntry', () => ({
  reloadClient: release.reload,
  mountClientRelease: (announce: (release: string | null, stale: boolean) => void) => {
    release.announce = announce;
    return release.stop;
  },
}));

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

test('availability preserves unfinished input and leaves reload behind explicit consent', async () => {
  const input = document.createElement('input');
  input.value = 'Unfinished pilot name';
  document.body.append(input);
  const component = mount(UpdateNotice, { target: document.body, props: { activeGame: true } });
  flushSync();
  expect(document.querySelector('aside')).toBeNull();
  expect(document.querySelector('[role=status]')?.textContent?.trim()).toBe('');
  input.focus();
  flushSync(() => release.announce('b'.repeat(40), false));
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('Unfinished pilot name');
  expect(document.querySelector('[role=dialog]')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('update is available');
  expect(document.querySelector('aside')?.textContent).toContain('requires rejoining');
  expect(document.querySelector('aside')?.textContent).toContain(
    'server update may disconnect you'
  );
  expect(release.reload).not.toHaveBeenCalled();
  const later = [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Later'
  );
  later?.click();
  flushSync();
  await tick();
  expect(release.reload).not.toHaveBeenCalled();
  const reopen = document.querySelector('aside button');
  expect(reopen?.textContent).toContain('Update available');
  await vi.waitFor(() => expect(document.activeElement).toBe(reopen));
  reopen?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
  await tick();
  await vi.waitFor(() =>
    expect(document.activeElement?.textContent).toContain('Update and reload')
  );
  expect(input.value).toBe('Unfinished pilot name');
  document.querySelector('button')?.click();
  flushSync();
  expect(release.reload).not.toHaveBeenCalled();
  expect(document.querySelector('[role=dialog]')?.textContent).toContain(
    'disconnects your current flight'
  );
  expect(document.querySelector('[role=dialog]')?.textContent).toContain(
    'loads the latest version'
  );
  expect(document.querySelector('[role=dialog]')?.textContent).toContain(
    'not reload automatically'
  );
  const cancel = [...document.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Keep this page open')
  );
  cancel?.click();
  flushSync();
  expect(document.querySelector('[role=dialog]')?.getAttribute('data-state')).toBe('closed');
  expect(document.querySelector('aside')).not.toBeNull();
  expect(release.reload).not.toHaveBeenCalled();
  document.querySelector('aside button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
  const confirm = [...document.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Reload now')
  );
  confirm?.click();
  expect(release.reload).toHaveBeenCalledTimes(1);
  await unmount(component);
  expect(release.stop).toHaveBeenCalled();
});

test('Later stays dismissed for that release and a distinct release reopens the notice', async () => {
  release.reload.mockClear();
  const component = mount(UpdateNotice, { target: document.body });
  flushSync();
  flushSync(() => release.announce('b'.repeat(40), false));
  const later = [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Later'
  );
  later?.click();
  await vi.waitFor(() =>
    expect(document.querySelector('aside button')?.textContent).toContain('Update available')
  );
  flushSync(() => release.announce('b'.repeat(40), false));
  expect(document.querySelector('aside button')?.textContent).toContain('Update available');
  flushSync(() => release.announce(null, false));
  flushSync(() => release.announce('b'.repeat(40), false));
  expect(document.querySelector('aside button')?.textContent).toContain('Update available');
  document.querySelector<HTMLButtonElement>('aside button')?.focus();
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(document.querySelector('aside button'))
  );
  const focused = document.activeElement;
  flushSync(() => release.announce('c'.repeat(40), false));
  expect(document.activeElement).toBe(focused);
  expect(document.querySelector('aside')?.textContent).toContain('Update and reload');
  expect(release.reload).not.toHaveBeenCalled();
  await unmount(component);
});

test('cancelling an in-flight application aborts it and a late result cannot alter a newer attempt', async () => {
  release.reload.mockClear();
  let finishFirst = (_result: { kind: string }) => {};
  let finishSecond = (_result: { kind: string }) => {};
  release.reload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      })
  );
  release.reload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSecond = resolve;
      })
  );
  const component = mount(UpdateNotice, { target: document.body, props: { activeGame: true } });
  flushSync();
  flushSync(() => release.announce('b'.repeat(40), false));
  const click = (label: string) => {
    const button = [...document.querySelectorAll('button')].find(
      (element) => element.textContent?.trim() === label
    );
    expect(button).toBeDefined();
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
  };
  click('Update and reload');
  click('Reload now');
  click('Checking update…');
  expect(release.reload).toHaveBeenCalledTimes(1);
  const firstSignal = release.reload.mock.calls[0]?.[1];
  click('Keep this page open');
  expect(firstSignal?.aborted).toBe(true);
  click('Update and reload');
  click('Reload now');
  expect(release.reload).toHaveBeenCalledTimes(2);
  finishFirst({ kind: 'unavailable' });
  await tick();
  flushSync();
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Checking update');
  expect(document.querySelector('[role=dialog]')?.textContent).not.toContain('Could not apply');
  finishSecond({ kind: 'unavailable' });
  await vi.waitFor(() =>
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Could not apply')
  );
  expect(release.reload).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role=dialog] [role=status]')?.textContent).toContain(
    'Could not apply'
  );
  expect(document.querySelector('[role=status]')?.textContent?.trim()).toBe('');
  await unmount(component);
});

test('a target that becomes current explains that no reload is needed and restores page focus on close', async () => {
  release.reload.mockClear();
  release.reload.mockResolvedValueOnce({ kind: 'current' });
  const input = document.createElement('input');
  document.body.append(input);
  const component = mount(UpdateNotice, { target: document.body });
  flushSync();
  input.focus();
  flushSync(() => release.announce('b'.repeat(40), false));
  document.querySelector('aside button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
  const confirm = [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Reload now'
  );
  confirm?.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role=dialog] [role=status]')?.textContent).toContain(
      'already up to date'
    )
  );
  expect(document.querySelector('aside')).toBeNull();
  const cancel = [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Keep this page open'
  );
  cancel?.click();
  await vi.waitFor(() => expect(document.activeElement).toBe(input));
  await unmount(component);
});

test('removing a focused notice restores a visible playfield instead of remembered hidden title input', async () => {
  const title = document.createElement('div');
  const input = document.createElement('input');
  title.append(input);
  const playfield = document.createElement('canvas');
  playfield.tabIndex = -1;
  document.body.append(title, playfield);
  const component = mount(UpdateNotice, { target: document.body, props: { activeGame: true } });
  flushSync();
  input.focus();
  flushSync(() => release.announce('b'.repeat(40), false));
  const later = [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Later'
  );
  later?.click();
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(document.querySelector('aside button'))
  );
  title.hidden = true;
  flushSync(() => release.announce(null, false));
  await vi.waitFor(() => expect(document.activeElement).toBe(playfield));
  expect(document.querySelector('aside')).toBeNull();
  await unmount(component);
});
