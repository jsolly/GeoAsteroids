import { beforeEach, expect, test } from 'vitest';
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
