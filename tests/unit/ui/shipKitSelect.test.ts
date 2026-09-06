import { beforeEach, expect, test } from 'vitest';
import { listShipKits } from '../../../src/entities/ship/shipKits';
import {
  getSelectedShipKitId,
  mountShipKitSelect,
  setSelectedShipKitId,
} from '../../../src/ui/shipKitSelect';

beforeEach(() => {
  setSelectedShipKitId('dart');
  mountShipKitSelect();
});

test('kit picker lists the five kits and selects Dart by default', () => {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('#ship-kit-grid [data-kit-id]')];
  expect(buttons.map((button) => button.dataset.kitId)).toEqual(listShipKits().map((kit) => kit.id));
  expect(getSelectedShipKitId()).toBe('dart');
  expect(buttons[0]?.classList.contains('is-selected')).toBe(true);
});

test('clicking Quake stores that kit for join', () => {
  const quake = document.querySelector<HTMLButtonElement>('[data-kit-id="quake"]');
  expect(quake).toBeTruthy();
  quake!.click();
  expect(getSelectedShipKitId()).toBe('quake');
  expect(quake!.getAttribute('aria-pressed')).toBe('true');
});
