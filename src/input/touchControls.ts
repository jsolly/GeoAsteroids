import type { Player } from '../entities/player/Player';
import { PlayerManager } from '../entities/player/PlayerManager';
import { shouldUseTouchControls } from '../ui/viewportChrome';
import { logger } from '../utils/Logger';
import { controlSources, resetTouchSources } from './controlSources';
import { reconcilePlayerInput } from './keybindings';
import { readStickSample, type StickSample } from './touchStick';

const STICK_ID = 'touch-stick';
const KNOB_ID = 'touch-stick-knob';
const FIRE_ID = 'touch-fire';
const ROOT_ID = 'touch-controls';

let initialized = false;
let stickPointerId: number | null = null;
let firePointerId: number | null = null;

export function applyStickSample(player: Player, sample: StickSample | null): void {
  if (!sample?.aim) {
    controlSources.touchThrust = false;
    controlSources.touchHeading = null;
    controlSources.touchStickActive = false;
    reconcilePlayerInput(player);
    return;
  }

  controlSources.touchStickActive = true;
  controlSources.touchHeading = sample.heading;
  controlSources.touchThrust = sample.thrusting;
  reconcilePlayerInput(player);
}

export function setTouchFire(player: Player, held: boolean): void {
  controlSources.touchFire = held;
  if (held) {
    if (player.lives > 0 && !player.ship.exploding) {
      player.ship.shoot();
    }
    return;
  }
  player.ship.canShoot = true;
}

export function tickTouchControls(player: Player): void {
  if (player.lives <= 0 || player.ship.exploding) {
    return;
  }
  if (controlSources.touchFire) {
    player.ship.shoot();
  }
  if (controlSources.touchStickActive) {
    reconcilePlayerInput(player);
  }
}

export function isTouchChromeVisible(): boolean {
  return typeof document !== 'undefined' && document.body.classList.contains('touch-play');
}

export function syncTouchChrome(
  inPlay = typeof document !== 'undefined' && document.body.classList.contains('in-play')
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const use = inPlay && shouldUseTouchControls();
  document.body.classList.toggle('touch-play', use);
  const root = document.getElementById(ROOT_ID);
  if (root) {
    root.hidden = !use;
    root.setAttribute('aria-hidden', use ? 'false' : 'true');
  }
  if (!use) {
    stickPointerId = null;
    firePointerId = null;
    resetTouchSources();
    resetKnob();
    setFirePressed(false);
  }
}

function resetKnob(): void {
  const knob = document.getElementById(KNOB_ID);
  if (knob) {
    knob.style.transform = 'translate(-50%, -50%)';
  }
}

function setFirePressed(pressed: boolean): void {
  document.getElementById(FIRE_ID)?.classList.toggle('is-pressed', pressed);
}

function requireLocalPlayer(): Player | null {
  try {
    return PlayerManager.getInstance().getLocalPlayer();
  } catch (error: unknown) {
    logger.debug(
      'INPUT',
      'Touch controls ignored — no local player',
      error instanceof Error ? { message: error.message } : {}
    );
    return null;
  }
}

function ensureTouchDom(): {
  root: HTMLElement;
  stick: HTMLElement;
  knob: HTMLElement;
  fire: HTMLElement;
} {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'touch-controls';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }

  let stick = document.getElementById(STICK_ID);
  if (!stick) {
    stick = document.createElement('div');
    stick.id = STICK_ID;
    stick.className = 'touch-stick';
    stick.setAttribute('role', 'slider');
    stick.setAttribute('aria-label', 'Steer and thrust');
    root.appendChild(stick);
  }

  let knob = document.getElementById(KNOB_ID);
  if (!knob) {
    knob = document.createElement('div');
    knob.id = KNOB_ID;
    knob.className = 'touch-stick-knob';
    stick.appendChild(knob);
  }

  let fire = document.getElementById(FIRE_ID);
  if (!fire) {
    fire = document.createElement('button');
    fire.id = FIRE_ID;
    fire.className = 'touch-fire';
    fire.setAttribute('type', 'button');
    fire.setAttribute('aria-label', 'Fire');
    fire.textContent = 'FIRE';
    root.appendChild(fire);
  }

  return { root, stick, knob, fire };
}

function stickOrigin(stick: HTMLElement): { x: number; y: number } {
  const rect = stick.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function onStickPointerDown(ev: PointerEvent, stick: HTMLElement, knob: HTMLElement): void {
  if (stickPointerId !== null) {
    return;
  }
  ev.preventDefault();
  stickPointerId = ev.pointerId;
  stick.setPointerCapture(ev.pointerId);
  moveStick(ev, stick, knob);
}

function onStickPointerMove(ev: PointerEvent, stick: HTMLElement, knob: HTMLElement): void {
  if (ev.pointerId !== stickPointerId) {
    return;
  }
  ev.preventDefault();
  moveStick(ev, stick, knob);
}

function onStickPointerUp(ev: PointerEvent, stick: HTMLElement): void {
  if (ev.pointerId !== stickPointerId) {
    return;
  }
  ev.preventDefault();
  stickPointerId = null;
  if (stick.hasPointerCapture(ev.pointerId)) {
    stick.releasePointerCapture(ev.pointerId);
  }
  resetKnob();
  const player = requireLocalPlayer();
  if (player) {
    applyStickSample(player, null);
  } else {
    resetTouchSources();
  }
}

function moveStick(ev: PointerEvent, stick: HTMLElement, knob: HTMLElement): void {
  const origin = stickOrigin(stick);
  const sample = readStickSample(ev.clientX, ev.clientY, origin.x, origin.y);
  knob.style.transform = `translate(calc(-50% + ${sample.knobX}px), calc(-50% + ${sample.knobY}px))`;
  const player = requireLocalPlayer();
  if (player) {
    applyStickSample(player, sample);
  }
}

function onFirePointerDown(ev: PointerEvent, fire: HTMLElement): void {
  if (firePointerId !== null) {
    return;
  }
  ev.preventDefault();
  firePointerId = ev.pointerId;
  fire.setPointerCapture(ev.pointerId);
  setFirePressed(true);
  const player = requireLocalPlayer();
  if (player) {
    setTouchFire(player, true);
  } else {
    controlSources.touchFire = true;
  }
}

function onFirePointerUp(ev: PointerEvent, fire: HTMLElement): void {
  if (ev.pointerId !== firePointerId) {
    return;
  }
  ev.preventDefault();
  firePointerId = null;
  if (fire.hasPointerCapture(ev.pointerId)) {
    fire.releasePointerCapture(ev.pointerId);
  }
  setFirePressed(false);
  const player = requireLocalPlayer();
  if (player) {
    setTouchFire(player, false);
  } else {
    controlSources.touchFire = false;
  }
}

export function initializeTouchControls(): void {
  if (initialized || typeof document === 'undefined') {
    return;
  }

  const { stick, knob, fire } = ensureTouchDom();

  stick.addEventListener('pointerdown', (ev) => onStickPointerDown(ev, stick, knob));
  stick.addEventListener('pointermove', (ev) => onStickPointerMove(ev, stick, knob));
  stick.addEventListener('pointerup', (ev) => onStickPointerUp(ev, stick));
  stick.addEventListener('pointercancel', (ev) => onStickPointerUp(ev, stick));

  fire.addEventListener('pointerdown', (ev) => onFirePointerDown(ev, fire));
  fire.addEventListener('pointerup', (ev) => onFirePointerUp(ev, fire));
  fire.addEventListener('pointercancel', (ev) => onFirePointerUp(ev, fire));

  window.addEventListener('playViewOn', () => syncTouchChrome(true));
  window.addEventListener('playViewOff', () => syncTouchChrome(false));
  window.addEventListener('resize', () => syncTouchChrome());
  window.visualViewport?.addEventListener('resize', () => syncTouchChrome());

  initialized = true;
  syncTouchChrome();
  logger.debug('INPUT', 'Touch controls initialized', {
    visible: isTouchChromeVisible(),
  });
}
