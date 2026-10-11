import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readWikiArticles } from '../../../scripts/wiki-content';
import WikiShell from '../../../src/components/wiki/WikiShell.svelte';

const charts = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn() }));
vi.mock('../../../src/wiki/shipScorecard', () => ({
  shipScorecard: () => '<div class="ship-radar"></div>',
  mountShipRadar: (...args: unknown[]) => {
    charts.mount(...args);
    return charts.dispose;
  },
}));
const articles = readWikiArticles();
let shell: ReturnType<typeof mount> | undefined;
let scrollY = 0;
async function settle() {
  flushSync();
  await Promise.resolve();
  flushSync();
  await Promise.resolve();
}
async function show(hash: string) {
  history.replaceState({}, '', `/wiki/${hash}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await settle();
}
beforeEach(() => {
  vi.useFakeTimers();
  charts.mount.mockClear();
  charts.dispose.mockClear();
  document.body.innerHTML = '';
  scrollY = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
  vi.spyOn(window, 'scrollTo').mockImplementation((_x, y) => {
    if (typeof y === 'number') {
      scrollY = y;
    }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16)
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  history.replaceState({}, '', '/wiki/');
});
afterEach(async () => {
  if (shell) {
    await unmount(shell);
  }
  shell = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  shell = mount(WikiShell, { target: document.body, props: { articles } });
  await settle();
}

test('readers search without changing the route and same-hash navigation returns to its beginning', async () => {
  await start();
  await show('#controls');
  expect(document.querySelectorAll('[data-panel]')).toHaveLength(1);
  expect(document.title).toBe('Controls | GeoRoids field manual');
  const input = document.querySelector<HTMLInputElement>('#wiki-search');
  if (!input) {
    throw new Error('Search input missing');
  }
  scrollY = 320;
  window.dispatchEvent(new Event('scroll'));
  input.value = 'hauler';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  expect(location.hash).toBe('#controls');
  expect(document.querySelector('[data-panel="search"]')).not.toBeNull();
  document.querySelector<HTMLAnchorElement>('a[href="#controls"]')?.click();
  await settle();
  expect(input.value).toBe('');
  expect(document.querySelector('[data-panel="article"]')?.id).toBe('controls');
  expect(scrollY).toBe(0);
});

test('unknown and malformed hashes keep the manual not-found behavior', async () => {
  await start();
  for (const hash of ['#does-not-exist', '#%E0%A4%A']) {
    await show(hash);
    expect(document.querySelectorAll('[data-panel]')).toHaveLength(1);
    expect(document.body.textContent).toContain('That entry is not in the manual.');
    expect(document.title).toBe('Entry not found | GeoRoids field manual');
  }
  await show('#content');
  expect(document.querySelector('[data-panel="overview"]')).not.toBeNull();
});

test('active articles own their chart and animation and release charts and timers on navigation and unmount', async () => {
  await start();
  await show('#hauler');
  expect(charts.mount).toHaveBeenCalledTimes(1);
  expect(document.querySelector<HTMLImageElement>('.demo img')?.getAttribute('src')).toBe(
    '/wiki/media/hauler.gif'
  );
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(document.querySelector<HTMLImageElement>('.demo img')?.getAttribute('src')).toBe(
    '/wiki/media/hauler.png'
  );
  await show('#controls');
  expect(charts.dispose).toHaveBeenCalledTimes(1);
  scrollY = 120;
  window.dispatchEvent(new Event('scroll'));
  const remember = vi.spyOn(history, 'replaceState');
  if (!shell) {
    throw new Error('Manual is not mounted');
  }
  await unmount(shell);
  shell = undefined;
  const writes = remember.mock.calls.length;
  const scrolls = vi.mocked(window.scrollTo).mock.calls.length;
  vi.advanceTimersByTime(1000);
  expect(remember).toHaveBeenCalledTimes(writes);
  expect(window.scrollTo).toHaveBeenCalledTimes(scrolls);
});

test('Back restores the visit offset and a remounted manual restores the saved reload offset', async () => {
  await start();
  await show('#controls');
  scrollY = 420;
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(500);
  const controlsState: unknown = history.state;
  await show('#hauler');
  scrollY = 90;
  history.replaceState(controlsState, '', '/wiki/#controls');
  window.dispatchEvent(new PopStateEvent('popstate', { state: controlsState }));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await settle();
  expect(scrollY).toBe(420);
  expect(document.querySelector('[data-panel="article"]')?.id).toBe('controls');
  if (!shell) {
    throw new Error('Manual is not mounted');
  }
  await unmount(shell);
  shell = undefined;
  scrollY = 0;
  await start();
  expect(scrollY).toBe(420);
});

test('a reader requesting reduced motion sees demonstration posters', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await start();
  await show('#hauler');
  expect(document.querySelector<HTMLImageElement>('.demo img')?.getAttribute('src')).toBe(
    '/wiki/media/hauler.png'
  );
});

test('mobile readers expand the manual navigation and it closes after choosing a topic', async () => {
  vi.stubGlobal('innerWidth', 390);
  shell = mount(WikiShell, { target: document.body, props: { articles } });
  const navigation = document.querySelector<HTMLDetailsElement>('#navigation');
  if (!navigation) {
    throw new Error('Manual navigation missing');
  }
  // The first render must be collapsed before mount effects choose a viewport layout.
  expect(navigation.open).toBe(false);
  await settle();
  expect(navigation.open).toBe(false);
  navigation.open = true;
  navigation.dispatchEvent(new Event('toggle'));
  await settle();
  expect(navigation.querySelector('a[href="#controls"]')).not.toBeNull();
  await show('#controls');
  expect(navigation.open).toBe(false);
  expect(document.querySelector('[data-panel="article"]')?.id).toBe('controls');
});

test('desktop readers see expanded navigation after the manual mounts', async () => {
  vi.stubGlobal('innerWidth', 1280);
  await start();
  expect(document.querySelector<HTMLDetailsElement>('#navigation')?.open).toBe(true);
});

test('blocked history writes report once while in-memory scroll restoration remains usable', async () => {
  const failure = new DOMException('History writes blocked', 'SecurityError');
  const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const replace = vi.spyOn(history, 'replaceState').mockImplementation(() => {
    throw failure;
  });
  await start();
  expect(document.querySelector('[data-panel="overview"]')).not.toBeNull();
  vi.runOnlyPendingTimers();
  scrollY = 320;
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(500);
  expect(replace.mock.calls.length).toBeGreaterThan(1);
  expect(report).toHaveBeenCalledExactlyOnceWith(
    '[WIKI] Saving scroll history failed; retaining it in memory for this visit',
    expect.objectContaining({ name: 'SecurityError', message: 'History writes blocked' })
  );

  const input = document.querySelector<HTMLInputElement>('#wiki-search');
  if (!input) {
    throw new Error('Search input missing');
  }
  input.value = 'hauler';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  expect(document.querySelector('[data-panel="search"]')).not.toBeNull();
  scrollY = 0;
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  expect(document.querySelector('[data-panel="overview"]')).not.toBeNull();
  await vi.waitFor(() => expect(scrollY).toBe(320));
  expect(report).toHaveBeenCalledOnce();
});
