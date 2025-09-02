import type { Player } from '../../entities/player/Player';
import { keyDown, keyUp } from '../../input/keybindings';
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  preventContextMenu,
} from '../../input/mouse';
import { logger } from '../../utils/Logger';
import { GameStateManager } from './GameStateManager';

export class InputManager {
  private static instance: InputManager;
  private gameStateManager: GameStateManager;
  private listenersInitialized = false;

  private constructor() {
    this.gameStateManager = GameStateManager.getInstance();
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  initializeListeners(localPlayer: Player): void {
    if (this.listenersInitialized) {
      return;
    }

    logger.debug('INPUT', 'Initializing InputManager listeners for player', {
      playerName: localPlayer.name,
    });

    // Keyboard listeners
    document.addEventListener('keydown', (ev) => {
      logger.debug('INPUT', 'Key down event', {
        key: ev.code,
        gameRunning: this.gameStateManager.getIsGameRunning(),
      });
      if (this.gameStateManager.getIsGameRunning()) {
        keyDown(ev, localPlayer);
      } else {
        logger.warn('INPUT', 'Key down ignored - game not running', { key: ev.code });
      }
    });

    document.addEventListener('keyup', (ev) => {
      logger.debug('INPUT', 'Key up event', {
        key: ev.code,
        gameRunning: this.gameStateManager.getIsGameRunning(),
      });
      // Always handle keyup events regardless of game state to prevent stuck keys
      keyUp(ev, localPlayer);
    });

    // Mouse listeners on canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('mousemove', (ev) => {
        if (this.gameStateManager.getIsGameRunning()) {
          handleMouseMove(ev, localPlayer);
        }
      });
      canvas.addEventListener('mousedown', (ev) => {
        if (this.gameStateManager.getIsGameRunning()) {
          handleMouseDown(ev, localPlayer);
        }
      });
      canvas.addEventListener('mouseup', (ev) => {
        if (this.gameStateManager.getIsGameRunning()) {
          handleMouseUp(ev, localPlayer);
        }
      });
      // Prevent default context menu for right-click thrust
      canvas.addEventListener('contextmenu', preventContextMenu);
    }

    this.listenersInitialized = true;
  }

  resetButtonText(): void {
    const gameBtn = document.getElementById('start-game') as HTMLButtonElement;

    if (gameBtn) {
      gameBtn.innerText = '🌐 Start Game';
    }
  }
}
