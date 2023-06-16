import express, { Request, Response } from 'express';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { MongoClient, Document } from 'mongodb';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface HighScore extends Document {
  name: string;
  score: number;
}

let db: MongoClient;

const connectDB = async (): Promise<void> => {
  const client = new MongoClient('mongodb://localhost:27017');
  db = await client.connect();
};

connectDB().catch((error) => console.error(error));

async function getHighScores(): Promise<HighScore[]> {
  const collection = db.db('geoasteroids').collection<HighScore>('highscores');
  const highScores = await collection
    .find()
    .sort({ score: -1 })
    .limit(10)
    .toArray();
  return highScores;
}

async function updateHighScores(newScore: HighScore): Promise<void> {
  const collection = db.db('geoasteroids').collection('highscores');

  await collection.insertOne(newScore);

  // Remove scores that are not in the top 10
  const scoresToKeep = await collection
    .find()
    .sort({ score: -1 })
    .limit(10)
    .toArray();
  const idsToKeep = scoresToKeep.map((score) => score._id);
  await collection.deleteMany({ _id: { $nin: idsToKeep } });
}

const app = express();

app.use(express.json()); // for parsing application/json

app.get('/api/highscores', (_, res) => {
  getHighScores()
    .then((highScores) => res.json({ highScores }))
    .catch((err) => {
      console.error(err);
      res.status(500).send('An error occurred while getting high scores.');
    });
});

app.post('/api/highscores', (req: Request, res: Response) => {
  const newScore = req.body as HighScore;
  updateHighScores(newScore)
    .then(() => res.json({ newScore }))
    .catch((err) => {
      console.error(err);
      res.status(500).send('An error occurred while updating high scores.');
    });
});

// Serve static files from the Vite build
const currentDir = path.join(__dirname, 'dist');

app.use(express.static(currentDir));

// Start the server
const port = process.env.PORT ?? 3001;
app.listen(port, (): void => {
  console.log(`Server running at http://localhost:${port}`);
});
