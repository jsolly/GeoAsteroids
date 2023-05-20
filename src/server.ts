import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express, { Request, Response } from 'express';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const HIGH_SCORES_FILE = './highscores.json';

interface HighScore {
  name: string;
  score: number;
}

async function getHighScores(): Promise<HighScore[]> {
  const data = await readFile(HIGH_SCORES_FILE, 'utf-8');
  if (data === '') {
    // File is empty, return an empty array
    return [];
  } else {
    // Try to parse the JSON data
    const highScores = JSON.parse(data) as HighScore[];
    return highScores;
  }
}

async function updateHighScores(newScore: HighScore): Promise<void> {
  let highScores = await getHighScores();

  // If there are less than 10 scores, or the new score is higher than the lowest score
  if (
    highScores.length < 10 ||
    newScore.score > highScores[highScores.length - 1].score
  ) {
    highScores.push(newScore);
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) {
      highScores = highScores.slice(0, 10); // keep only the top 10 scores
    }

    await writeFile(HIGH_SCORES_FILE, JSON.stringify(highScores, null, 2));
  }
}

app.use(express.json()); // for parsing application/json

app.get('/api/highscores', (_, res: Response): void => {
  void (async (): Promise<void> => {
    const highScores = await getHighScores();
    res.json({ highScores });
  })();
});

app.post('/api/highscores', (req: Request, res: Response): void => {
  void (async (): Promise<void> => {
    const newScore = req.body as HighScore;
    await updateHighScores(newScore);
    res.json({ newScore });
  })();
});

// Serve static files from the Vite build
const currentDir = path.join(__dirname, 'dist');

app.use(express.static(currentDir));

// Start the server
const port = process.env.PORT ?? 3001;
app.listen(port, (): void => {
  console.log(`Server running at http://localhost:${port}`);
});
