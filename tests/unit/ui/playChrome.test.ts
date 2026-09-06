import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { setPlayView } from '../../../src/ui/uiUtils';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');

test('title shell drops the photo starfield and Freepik credit', () => {
  expect(html).not.toMatch(/Freepik/i);
  expect(html).toMatch(/id="title-starfield"/);
  expect(css).not.toMatch(/spaceBackground/);
  expect(css).toMatch(/#title-starfield/);
  expect(css).toMatch(/--palette-bg/);
});

test('Enter Game is an outline phosphor control, not a solid green fill', () => {
  expect(html).toMatch(/btn-phosphor/);
  expect(html).not.toMatch(/btn-success/);
  expect(css).toMatch(/\.btn-phosphor/);
  expect(css).toMatch(/background:\s*transparent/);
  expect(css).toMatch(/--palette-accent/);
});

test('title menu shows a phosphor WASD + Space / arrows hint', () => {
  const startScreen = html.slice(html.indexOf('id="start-screen"'), html.indexOf('id="gameArea"'));
  expect(startScreen).toMatch(/id="controls-hint"/);
  expect(startScreen).toMatch(/WASD \+ Space \/ arrows · E ability/);
  expect(css).toMatch(/\.controls-hint/);
  expect(css).toMatch(/--palette-accent/);
});

test('title menu lets a pilot pick a ship kit before enter', () => {
  const startScreen = html.slice(html.indexOf('id="start-screen"'), html.indexOf('id="gameArea"'));
  expect(startScreen).toMatch(/id="ship-kit-grid"/);
  expect(startScreen).toMatch(/AD v2 silhouettes/);
  expect(startScreen).not.toMatch(/no factions/i);
  expect(css).toMatch(/\.ship-kit-grid/);
});

test('controls hint stays off the live playfield', () => {
  const gameArea = html.slice(html.indexOf('id="gameArea"'));
  expect(gameArea).not.toMatch(/controls-hint/);
  expect(css).toMatch(/body\.in-play \.controls-hint/);
});

test('play view hides stock credit/version without touching the network banner', () => {
  expect(css).toMatch(/body\.in-play #attribution/);
  expect(document.getElementById('controls-hint')?.closest('#start-screen')).toBeTruthy();
  setPlayView(true);
  expect(document.body.classList.contains('in-play')).toBe(true);
  expect(document.getElementById('start-screen')?.style.display).toBe('none');
  expect(document.getElementById('gameArea')?.style.display).toBe('block');
  setPlayView(false);
  expect(document.body.classList.contains('in-play')).toBe(false);
  expect(document.getElementById('start-screen')?.style.display).toBe('block');
  expect(document.getElementById('gameArea')?.style.display).toBe('none');
});
