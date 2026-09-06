import { beforeEach, expect, test } from 'vitest';

import { PALETTE } from '../../../src/constants';
import { DISCONNECT_BANNER_TEXT } from '../../../src/ui/copy';
import {
  hideNetworkBanner,
  initNetworkStatusUI,
  isNetworkBannerVisible,
  showNetworkBanner,
} from '../../../src/ui/networkStatus';

beforeEach(() => {
  hideNetworkBanner();
});

test('banner is hidden by default', () => {
  expect(isNetworkBannerVisible()).toBe(false);
});

test('showNetworkBanner reveals it and hideNetworkBanner hides it', () => {
  showNetworkBanner('Disconnected');
  expect(isNetworkBannerVisible()).toBe(true);
  hideNetworkBanner();
  expect(isNetworkBannerVisible()).toBe(false);
});

test('a networkDisconnected event shows the banner; (re)connect hides it', () => {
  initNetworkStatusUI();

  window.dispatchEvent(new CustomEvent('networkDisconnected', { detail: { reason: 'test' } }));
  expect(isNetworkBannerVisible()).toBe(true);

  window.dispatchEvent(new CustomEvent('networkConnected'));
  expect(isNetworkBannerVisible()).toBe(false);

  window.dispatchEvent(new CustomEvent('networkDisconnected', { detail: {} }));
  expect(isNetworkBannerVisible()).toBe(true);

  window.dispatchEvent(new CustomEvent('networkReconnected'));
  expect(isNetworkBannerVisible()).toBe(false);
});

test('disconnect bar uses the matte blush palette, never white', () => {
  showNetworkBanner(DISCONNECT_BANNER_TEXT);
  const el = document.getElementById('network-status-banner');
  expect(el).not.toBeNull();
  expect(el?.textContent).toBe(DISCONNECT_BANNER_TEXT);
  const color = el?.style.color.toLowerCase() ?? '';
  const border = el?.style.borderBottom.toLowerCase() ?? '';
  const background = el?.style.background.toLowerCase() ?? '';
  expect(color === PALETTE.HUD.toLowerCase() || color === 'rgb(226, 232, 240)').toBe(true);
  expect(border.includes(PALETTE.DANGER.toLowerCase()) || border.includes('244, 63, 94')).toBe(
    true
  );
  expect(color).not.toBe('#ffffff');
  expect(color).not.toBe('rgb(255, 255, 255)');
  expect(background).not.toContain('255, 255, 255');
});
