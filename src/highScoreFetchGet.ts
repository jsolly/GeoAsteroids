import { getElementById } from './utils';
import { drawSpace } from './canvas';
import { toggleScreen } from './mainMenu';
import { getCurrentScore } from './runtimeVars';
import { logger } from './logger';
const highScoresList = getElementById<HTMLOListElement>('highScoresList');

interface HighScore {
  name: string;
  score: number;
}

async function submitName(): Promise<void> {
  const nameInput = getElementById<HTMLInputElement>('nameInput');
  if (!nameInput) {
    return;
  }

  validateInput(nameInput);
  const name = nameInput.value;
  const score = getCurrentScore();

  // Call Serverside API to save score
  const highScore: HighScore = { name, score };
  await postHighScore(highScore);

  // Hide the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'none';
  }

  // Clear the input field for the next game
  nameInput.value = '';

  const startGameBtn = getElementById<HTMLButtonElement>('start-game');
  if (startGameBtn) {
    startGameBtn.innerText = 'Play Again! 🚀';
  }

  toggleScreen('start-screen', true);
  drawSpace(); // Clear the canvas after the score is submitted
  toggleScreen('gameArea', false);
}

function validateInput(input: HTMLInputElement): void {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, '');
}

async function postHighScore(highScore: HighScore): Promise<void> {
  try {
    const response = await fetch('/api/highscores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(highScore),
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
  } catch (error) {
    logger.logError(error);
  }
}

async function fetchHighScores(): Promise<void> {
  try {
    const response = await fetch('/api/highscores');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = (await response.json()) as HighScore[]; // changed this line

    if (highScoresList) {
      // Clear any existing scores
      highScoresList.innerHTML = '';

      // Add new scores to the DOM
      data.forEach((score) => {
        const li = document.createElement('li');
        li.textContent = `${score.name}: ${score.score}`;
        highScoresList.appendChild(li);
      });
    }
  } catch (error) {
    logger.logError(error);
  }
}

export { submitName, validateInput, fetchHighScores };
