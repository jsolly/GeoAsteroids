import { toggleScreen } from './mainMenu';
import { Ship } from './ship.js';
import { RoidBelt } from './asteroids.js';
import { newLevelText, setTextProperties } from './canvas';
import { Music } from './soundsMusic';
import { keyDown, keyUp } from './keybindings';
import { setIsGameRunning, gameLoop } from './eventLoop';
import { GameState } from './gameState';
const gameState = GameState.getInstance();

const music = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');
let currShip = new Ship();
let currRoidBelt = new RoidBelt(currShip);

document.addEventListener('keydown', (ev) => keyDown(ev, currShip));
document.addEventListener('keyup', (ev) => keyUp(ev, currShip));

function getCurrentShip(): Ship {
  return currShip;
}

function resetMusicTempo(): void {
  music.setMusicTempo(1.0);
}

function tickMusic(): void {
  music.tick();
}

/**
 * Start a new level. This is called on game start and when the player
 * levels up
 */
function levelUp(): void {
  gameState.updateCurrentLevel();
  gameState.updateNextLevel();
  newLevelText(gameState.getCurrentLevel());
  currRoidBelt.addRoid(currShip); // add a new asteroid for each new level
  music.setMusicTempo(1.0 + gameState.getCurrentLevel() / 10);
}

function newGame(): void {
  gameState.resetCurrentScore();
  gameState.resetCurrentLevel();
  newLevelText(gameState.getCurrentLevel());
  currShip = new Ship();
  currRoidBelt = new RoidBelt(currShip);
  music.setMusicTempo(1.0);
}

function startGame(): void {
  newGame();
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);

  setIsGameRunning(true);
  window.requestAnimationFrame(gameLoop);
}

/**
 * Called when ship lives = 0. Calls functions to end the game.
 */
function gameOver(): void {
  const currShip = getCurrentShip();
  currShip.die();
  setTextProperties('Game Over', 1.0);
  resetMusicTempo();
}

/**
 * Runs the game. Called every frame to move the game forward.
 */

export {
  getCurrentShip,
  levelUp,
  tickMusic,
  startGame,
  gameOver,
  currShip,
  currRoidBelt,
};
