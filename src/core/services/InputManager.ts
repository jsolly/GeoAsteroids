import { PlayerManager } from '../../entities/player/PlayerManager';
import { applyLocalOverlayHold } from '../../entities/ship/shipUtils';
import { resetControlSources } from '../../input/controlSources';
import {
  getPressedKeysForPlayer,
  keyDown,
  keyUp,
  reconcilePlayerInput,
} from '../../input/keybindings';
import { handleMouseDown, handleMouseMove, preventContextMenu } from '../../input/mouse';
import {
  disposePlayfieldSelection,
  initializePlayfieldSelection,
} from '../../input/playfieldSelection';
import {
  closeGameOverlay,
  getOpenGameOverlay,
  subscribeGameOverlay,
} from '../../runtime/overlayState';
import { logger } from '../../utils/Logger';
import { GameStateManager } from './GameStateManager';

export class InputManager {
  private static instance: InputManager;
  private gameStateManager: GameStateManager;
  private listenersInitialized = false;
  private listenerScope: AbortController | null = null;
  private unsubscribeOverlay: (() => void) | undefined;

  private constructor() {
    this.gameStateManager = GameStateManager.getInstance();
  }

  static getInstance(): InputManager {
    if (InputManager.instance == null) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  initializeListeners(canvas: HTMLCanvasElement): void {
    if (this.listenersInitialized) {
      return;
    }

    logger.debug('INPUT', 'Initializing InputManager listeners');
    this.listenerScope = new AbortController();
    const { signal } = this.listenerScope;
    try {
      this.installListeners(canvas, signal);
      this.listenersInitialized = true;
    } catch (error) {
      this.detachRuntime();
      throw error;
    }
  }

  private installListeners(canvas: HTMLCanvasElement, signal: AbortSignal): void {
    const getLocalPlayer = () => PlayerManager.getInstance().getLocalPlayer();

    // Keyboard listeners
    document.addEventListener(
      'keydown',
      (ev) => {
        if (
          ev.target instanceof Element &&
          ev.target.closest(
            'input, textarea, select, button, summary, a[href], [role=button], [contenteditable]'
          )
        ) {
          return;
        }
        // Shared overlay state gates gameplay synchronously before Svelte mounts
        // the dialog and its map keyboard controller.
        if (getOpenGameOverlay() !== null) {
          return;
        }
        const localPlayer = getLocalPlayer();
        if (!localPlayer) {
          return;
        }

        if (this.gameStateManager.getIsGameRunning()) {
          keyDown(ev, localPlayer);
        }
      },
      { signal }
    );

    document.addEventListener(
      'keyup',
      (ev) => {
        if (getOpenGameOverlay() !== null) {
          return;
        }
        const localPlayer = getLocalPlayer();
        if (!localPlayer) {
          return;
        }

        // Always handle keyup events regardless of game state to prevent stuck keys
        keyUp(ev, localPlayer);
      },
      { signal }
    );

    // Mouse listeners on canvas
    canvas.addEventListener(
      'mousemove',
      (ev) => {
        const localPlayer = getLocalPlayer();
        if (localPlayer && this.gameStateManager.getIsGameRunning()) {
          handleMouseMove(ev, localPlayer);
        }
      },
      { signal }
    );
    canvas.addEventListener(
      'mousedown',
      (ev) => {
        const localPlayer = getLocalPlayer();
        if (localPlayer && this.gameStateManager.getIsGameRunning()) {
          handleMouseDown(ev, localPlayer);
        }
      },
      { signal }
    );
    // Keep browser context menus out of the playfield
    canvas.addEventListener('contextmenu', preventContextMenu, { signal });
    canvas.addEventListener(
      'touchstart',
      (ev) => {
        if (ev.cancelable) {
          ev.preventDefault();
        }
      },
      { passive: false, signal }
    );

    // Reset shoot cooldown if the mouse is released outside the canvas
    document.addEventListener(
      'mouseup',
      (ev) => {
        const localPlayer = getLocalPlayer();
        if (localPlayer && ev.button === 0) {
          localPlayer.ship.canShoot = true;
          localPlayer.ship.finishWeaponCharge(false);
        }
      },
      { signal }
    );

    const releaseInput = () => this.releaseHeldInput();
    window.addEventListener('blur', releaseInput, { signal });
    window.addEventListener('pagehide', releaseInput, { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          releaseInput();
        }
      },
      { signal }
    );
    initializePlayfieldSelection();
    this.unsubscribeOverlay = subscribeGameOverlay(() => this.releaseHeldInput());
  }

  releaseHeldInput(): void {
    this.updateMovementLock();
    const localPlayer = PlayerManager.getInstance().getLocalPlayer();
    resetControlSources();
    if (localPlayer) {
      getPressedKeysForPlayer(localPlayer).clear();
      localPlayer.ship.canShoot = true;
      localPlayer.ship.finishWeaponCharge(false);
      reconcilePlayerInput(localPlayer);
    }
  }

  detachRuntime(): void {
    const overlay = getOpenGameOverlay();
    if (overlay !== null) {
      closeGameOverlay(overlay);
    }
    this.releaseHeldInput();
    this.unsubscribeOverlay?.();
    this.unsubscribeOverlay = undefined;
    this.listenerScope?.abort();
    this.listenerScope = null;
    this.listenersInitialized = false;
    disposePlayfieldSelection();
  }

  /** Lock navigation and collisions while a map, schematic, or town store is open. */
  updateMovementLock(): void {
    const player = PlayerManager.getInstance().getLocalPlayer();
    const ship = player?.ship;
    if (!ship) {
      return;
    }
    const held = getOpenGameOverlay() !== null;
    const changed = applyLocalOverlayHold(ship, held);
    if (changed) {
      PlayerManager.getInstance().updateNetworkState();
    }
  }
}
