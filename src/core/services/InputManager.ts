import type { Player } from '../../entities/player/Player';
import { keyDown, keyUp } from '../../input/keybindings';
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  preventContextMenu,
} from '../../input/mouse';
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

    // Keyboard listeners
    document.addEventListener('keydown', (ev) => {
      if (this.gameStateManager.getIsGameRunning()) {
        keyDown(ev, localPlayer);
      }
    });

    document.addEventListener('keyup', (ev) => {
      if (this.gameStateManager.getIsGameRunning()) {
        keyUp(ev, localPlayer);
      }
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
    const multiplayerBtn = document.getElementById('start-multiplayer') as HTMLButtonElement;

    if (multiplayerBtn) {
      multiplayerBtn.innerText = '🌐 Start Multiplayer Game';
    }
  }
}
