import { PALETTE, VISUAL } from '../constants';
import { hexToRgba } from '../utils/colorUtils';
import { logger } from '../utils/Logger';
import { DISCONNECT_BANNER_TEXT } from './copy';

/**
 * Matte blush disconnect bar — palette danger on a quiet hairline strip.
 * No CRT red wash, no #FFFFFF, no drop-shadow glow.
 */

const BANNER_ID = 'network-status-banner';
let initialized = false;

function applyBannerStyle(el: HTMLElement): void {
  el.className = 'network-status-banner';
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '10000',
    padding: '8px 16px',
    textAlign: 'center',
    background: hexToRgba(PALETTE.DANGER, 0.16),
    color: PALETTE.HUD,
    borderBottom: `1px solid ${PALETTE.DANGER}`,
    font: `13px/1.4 ${VISUAL.HUD_FONT_FAMILY}`,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    boxShadow: 'none',
    display: 'none',
  });
}

function getOrCreateBanner(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'alert');
    applyBannerStyle(el);
    (document.body ?? document.documentElement).appendChild(el);
  }
  return el;
}

export function showNetworkBanner(message: string): void {
  const el = getOrCreateBanner();
  if (!el) {
    return;
  }
  el.textContent = message;
  el.style.display = 'block';
}

export function hideNetworkBanner(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.getElementById(BANNER_ID);
  if (el) {
    el.style.display = 'none';
  }
}

export function isNetworkBannerVisible(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const el = document.getElementById(BANNER_ID);
  return el !== null && el.style.display !== 'none';
}

/**
 * Wire the banner to the network lifecycle events dispatched by
 * ConnectionManager. Idempotent — safe to call more than once.
 */
export function initNetworkStatusUI(): void {
  if (initialized || typeof window === 'undefined') {
    return;
  }
  initialized = true;

  window.addEventListener('networkConnected', () => hideNetworkBanner());
  window.addEventListener('networkReconnected', () => hideNetworkBanner());
  window.addEventListener('networkDisconnected', (event) => {
    const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
    showNetworkBanner(DISCONNECT_BANNER_TEXT);
    logger.warn('NETWORK', 'Displayed disconnect banner', { reason });
  });
}
