import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

async function onCanvasAsteroidCount(
  game: GameInteractions,
  canvas = { width: 1920, height: 1080 }
): Promise<number> {
  const ship = await game.getShipPosition();
  const field = await game.getAsteroidPositions();
  return field.filter((roid) => {
    const screenX = canvas.width / 2 - ship.x + roid.x;
    const screenY = canvas.height / 2 - ship.y + roid.y;
    return screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height;
  }).length;
}

test('second player sees shared asteroid field', async () => {
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');

  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');

  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);

  await game1.bootSinglePlayerGame();
  await game1.waitForAsteroids(1);
  const count1 = await game1.getAsteroidCount();

  await game2.bootSinglePlayerGame();
  await game2.waitForAsteroids(1);
  const count2 = await game2.getAsteroidCount();

  expect(count1).toBeGreaterThan(0);
  expect(Math.abs(count1 - count2)).toBeLessThanOrEqual(2);

  const field1Start = await game1.getAsteroidPositions();
  await page1.waitForTimeout(1500);
  const field1Later = await game1.getAsteroidPositions();
  const field2Later = await game2.getAsteroidPositions();

  const moved = field1Start.some((start) => {
    const later = field1Later.find((roid) => roid.id === start.id);
    return later !== undefined && (Math.abs(later.x - start.x) > 1 || Math.abs(later.y - start.y) > 1);
  });
  expect(moved, 'asteroids should translate over ~1.5s').toBe(true);

  const ids1 = [...field1Later.map((roid) => roid.id)].sort();
  const ids2 = [...field2Later.map((roid) => roid.id)].sort();
  expect(ids1).toEqual(ids2);

  for (const roid of field1Later) {
    const peer = field2Later.find((other) => other.id === roid.id);
    expect(peer).toBeDefined();
    expect(Math.abs(peer!.x - roid.x)).toBeLessThan(80);
    expect(Math.abs(peer!.y - roid.y)).toBeLessThan(80);
  }

  expect(
    await onCanvasAsteroidCount(game1),
    'tab 1 canvas should show in-belt asteroids, not only minimap dots'
  ).toBeGreaterThan(0);
  expect(
    await onCanvasAsteroidCount(game2),
    'tab 2 canvas should show the same in-belt field'
  ).toBeGreaterThan(0);

  await expect
    .poll(() => game1.getAllPlayerCount(), { timeout: 10000, message: 'both players should see each other' })
    .toBeGreaterThanOrEqual(2);

  const remotesBefore = await page1.evaluate(() => {
    const gc = (window as { gameController?: { getNetworkManager?: () => { getAllPlayers?: () => Array<{ type: string }> } } }).gameController;
    return (gc?.getNetworkManager?.().getAllPlayers?.() ?? []).filter((player) => player.type === 'remote')
      .length;
  });
  expect(remotesBefore).toBeGreaterThanOrEqual(1);

  await page2.close();

  await expect
    .poll(
      async () =>
        page1.evaluate(() => {
          const gc = (window as { gameController?: { getNetworkManager?: () => { getAllPlayers?: () => Array<{ type: string }> } } }).gameController;
          return (gc?.getNetworkManager?.().getAllPlayers?.() ?? []).filter(
            (player) => player.type === 'remote'
          ).length;
        }),
      { timeout: 10000, message: 'departed tab should leave the remaining client' }
    )
    .toBeLessThan(remotesBefore);

  const afterDisconnect = await game1.getAsteroidPositions();
  expect(afterDisconnect.map((roid) => roid.id).sort()).toEqual(ids1);
  expect(await onCanvasAsteroidCount(game1)).toBeGreaterThan(0);

  await page1.waitForTimeout(800);
  const afterDisconnectLater = await game1.getAsteroidPositions();
  const stillMoving = afterDisconnect.some((start) => {
    const later = afterDisconnectLater.find((roid) => roid.id === start.id);
    return later !== undefined && (Math.abs(later.x - start.x) > 1 || Math.abs(later.y - start.y) > 1);
  });
  expect(stillMoving, 'remaining tab should keep a moving field after peer disconnect').toBe(true);
}, TestConfig.DEFAULT_TIMEOUT * 2);
