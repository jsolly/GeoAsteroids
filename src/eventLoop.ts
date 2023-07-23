import { FPS, SHIP_INV_BLINK_DUR, musicIsOn } from './constants';
import { detectLaserHits, detectRoidHits } from './collisions';
import { drawGameCanvas } from './canvas';
import { drawShipRelative, drawShipExplosion } from './shipCanv';
import { GameController } from './gameController';
import { Ship } from './ship';
const gameController = GameController.getInstance();

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
  const currShip = gameController.getCurrShip();
  const currRoidBelt = gameController.getCurrRoidBelt();
  const currScore = gameController.getCurrScore();
  const personalBest = gameController.getPersonalBest();
  const textAlpha = gameController.getTextAlpha();
  const text = gameController.getText();
  handleLevelUp();

  drawGameCanvas(
    currShip,
    currRoidBelt,
    currScore,
    personalBest,
    textAlpha,
    text,
  );

  handleMusic();
  handleShipState(currShip);
  handleCollision(currShip);

  if (!currShip.exploding) currShip.move();

  currShip.moveLasers();
  currRoidBelt.moveRoids();
}

function handleLevelUp(): void {
  if (gameController.getCurrScore() > gameController.getNextLevel()) {
    gameController.levelUp();
  }
}

function handleMusic(): void {
  if (musicIsOn()) {
    gameController.tickMusic();
  }
}

function handleShipState(ship: Ship): void {
  ship.setBlinkOn();
  ship.setExploding();

  if (!ship.exploding) {
    if (ship.blinkOn && !ship.dead) {
      drawShipRelative(ship);
    }

    if (ship.blinkCount > 0) {
      ship.blinkTime--;

      if (ship.blinkTime == 0) {
        ship.blinkTime = Math.ceil(SHIP_INV_BLINK_DUR * FPS);
        ship.blinkCount--;
      }
    }
  } else {
    handleShipExplosion(ship);
  }
}

function handleShipExplosion(ship: Ship): void {
  drawShipExplosion(ship);
  ship.explodeTime--;

  if (ship.explodeTime == 0) {
    ship.lives--;
    if (ship.lives == 0) {
      gameController.gameOver();
    }
  }
}

function handleCollision(ship: Ship): void {
  const currRoidBelt = gameController.getCurrRoidBelt();
  gameController.updateCurrScore(detectLaserHits(currRoidBelt, ship));
  gameController.updateCurrScore(detectRoidHits(ship, currRoidBelt));
  gameController.updatePersonalBest();
}

export { setIsGameRunning, gameLoop };
