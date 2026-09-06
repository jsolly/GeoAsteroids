import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { SAUCER_HULL_COLOR } from '../../../src/entities/npc/saucerRenderHook';
import { SHIP_KIT_IDS } from '../../../src/entities/ship/shipKits';

test('satellite renderer paints through the saucer swap hook, not a sixth kit', () => {
  const renderer = readFileSync(
    resolve(process.cwd(), 'src/entities/satellite/satelliteRenderer.ts'),
    'utf8'
  );
  expect(renderer).toContain('drawSaucerNpc');
  expect(renderer).toContain('saucerRenderHook');
  expect(renderer).not.toMatch(/class Hook/);
  expect(SHIP_KIT_IDS).toEqual(['dart', 'hauler', 'warden', 'skirmisher', 'quake']);
  expect(SAUCER_HULL_COLOR).toBe('#C4B5FD');
});
