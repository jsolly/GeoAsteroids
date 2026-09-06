import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const gameInfoSrc = readFileSync(resolve(process.cwd(), 'src/rendering/hud/gameInfo.ts'), 'utf8');

test('kill toast does not replace the score', () => {
  const scoreDraw = gameInfoSrc.indexOf('fillText(score.toString()');
  const killDraw = gameInfoSrc.indexOf('hasKillMessage()');
  expect(scoreDraw).toBeGreaterThan(0);
  expect(killDraw).toBeGreaterThan(scoreDraw);
});
