import { FPS, SHIP_INV_BLINK_DUR, musicIsOn } from './config';
import { detectLaserHits, detectRoidHits } from './collisions';
import { drawGameCanvas } from './canvas';
import { drawShipRelative, drawShipExplosion } from './shipCanv';
import {
  currShip,
  currRoidBelt,
  updatePersonalBest,
  levelUp,
  gameOver,
  tickMusic,
} from './runtimeVars';
import { GameState } from './gameState';
const gameState = GameState.getInstance();

let isGameRunning: boolean;
let lastTimestamp: number;

function gameLoop(timestamp: number): void {
  if (!isGameRunning) return;

  const elapsedSeconds = updateTimestamp(timestamp);

  if (elapsedSeconds > 1 / FPS) {
    updateGame();
  }

  window.requestAnimationFrame(gameLoop);
}

function updateTimestamp(timestamp: number): number {
  const elapsedSeconds = (timestamp - lastTimestamp) / 1000; // Convert ms to seconds
  lastTimestamp = timestamp;
  return elapsedSeconds;
}

function setIsGameRunning(value: boolean): void {
  isGameRunning = value;
}

function updateGame(): void {
  handleLevelUp();

  drawGameCanvas();

  handleMusic();

  handleShipState();

  handleCollision();

  if (!currShip.exploding) currShip.move();

  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

function handleLevelUp(): void {
  if (gameState.getCurrentScore() > gameState.getNextLevel()) {
    levelUp();
  }
}

function handleMusic(): void {
  if (musicIsOn()) {
    tickMusic();
  }
}

function handleShipState(): void {
  currShip.setBlinkOn();
  currShip.setExploding();

  if (!currShip.exploding) {
    if (currShip.blinkOn && !currShip.dead) {
      drawShipRelative(currShip);
    }

    if (currShip.blinkCount > 0) {
      currShip.blinkTime--;

      if (currShip.blinkTime == 0) {
        currShip.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        currShip.blinkCount--;
      }
    }
  } else {
    handleShipExplosion();
  }
}

function handleShipExplosion(): void {
  drawShipExplosion(currShip);
  currShip.explodeTime--;

  if (currShip.explodeTime == 0) {
    currShip.lives--;
    if (currShip.lives == 0) {
      gameOver();
    }
  }
}

function handleCollision(): void {
  gameState.updateCurrentScore(detectLaserHits(currRoidBelt, currShip));
  gameState.updateCurrentScore(detectRoidHits(currShip, currRoidBelt));
  updatePersonalBest();
}

export { setIsGameRunning, gameLoop };
