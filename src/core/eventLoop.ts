import { canvasManager } from '../rendering/canvas';
import { initNetworkStatusUI } from '../ui/networkStatus';
import '../ui/mainMenu'; // wires nickname + Enter Game listeners
import { logger } from '../utils/Logger';
import { GameController } from './gameController';

const gameController = GameController.getInstance();

// Surface a visible banner whenever the game-server connection drops.
initNetworkStatusUI();

// Initialize canvas with proper scaling after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => canvasManager.initialize());
} else {
  canvasManager.initialize();
}

// Game loop with updates and rendering
window.addEventListener('gameStart', () => {
  function gameLoop(): void {
    if (!gameController.getIsGameRunning()) {
      return;
    }

    try {
      // Update game state first
      gameController.updateGame();

      // Then render the current game state
      gameController.renderGame();
    } catch (error) {
      logger.error(
        'GAME_LOOP',
        'Error in game loop',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});
