import { canvasManager } from '../rendering/canvas';
import '../ui/mainMenu'; // wires nickname + Enter Game listeners
import { initNetworkStatusUI } from '../ui/networkStatus';
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
let gameLoopScheduled = false;
window.addEventListener('gameStart', () => {
  if (gameLoopScheduled) {
    return;
  }
  gameLoopScheduled = true;
  let lastTime = performance.now();

  function gameLoop(now: number): void {
    if (!gameController.getIsGameRunning()) {
      gameLoopScheduled = false;
      return;
    }

    try {
      const dtMs = now - lastTime;
      lastTime = now;
      gameController.updateGame(dtMs);

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
