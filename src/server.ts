import express, { Request, Response } from 'express';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json()); // for parsing application/json

interface HighScore {
  name: string;
  score: number;
}

let db: MongoClient | null = null;

async function getDb(): Promise<MongoClient> {
  if (db === null) {
    // use different database connection strings depending on the environment
    const connectionString =
      process.env.NODE_ENV === 'production'
        ? process.env.MONGODB_URI
        : 'mongodb://localhost:27017/';
    if (!connectionString) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    const client = new MongoClient(connectionString);
    db = await client.connect();
  }
  return db;
}

async function getHighScores(): Promise<HighScore[]> {
  try {
    const db = await getDb();
    const collection = db
      .db('geoasteroids')
      .collection<HighScore>('highscores');
    const highScores = await collection
      .find()
      .sort({ score: -1 })
      .limit(10)
      .toArray();
    return highScores;
  } catch (error) {
    console.error('Error executing query', error);
    // If there's an error, set db to null to force reconnection next time
    db = null;
    throw error;
  }
}

async function updateHighScores(newScore: HighScore): Promise<void> {
  try {
    const db = await getDb();
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
  } catch (error) {
    console.error('Error executing query', error);
    // If there's an error, set db to null to force reconnection next time
    db = null;
    throw error;
  }
}

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
