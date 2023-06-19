import { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

interface HighScore {
  name: string;
  score: number;
}

async function getDb(): Promise<MongoClient> {
  const connectionString =
    process.env.NODE_ENV === 'production'
      ? process.env.MONGODB_URI
      : 'mongodb://127.0.0.1:27017';
  if (!connectionString) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  const client = new MongoClient(connectionString);
  await client.connect();

  return client;
}

async function getHighScores(): Promise<HighScore[]> {
  const client = await getDb();
  try {
    const collection = client
      .db('geoasteroids')
      .collection<HighScore>('highscores');
    const highScores = await collection
      .find()
      .sort({ score: -1 })
      .limit(10)
      .toArray();
    return highScores;
  } finally {
    await client.close();
  }
}

async function updateHighScores(newScore: HighScore): Promise<void> {
  const client = await getDb();
  try {
    const collection = client.db('geoasteroids').collection('highscores');
    await collection.insertOne(newScore);

    const scoresToKeep = await collection
      .find()
      .sort({ score: -1 })
      .limit(10)
      .toArray();
    const idsToKeep = scoresToKeep.map((score) => score._id);
    await collection.deleteMany({ _id: { $nin: idsToKeep } });
  } finally {
    await client.close();
  }
}

export default async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> => {
  if (req.method === 'GET') {
    const highScores = await getHighScores();
    res.json(highScores);
  } else if (req.method === 'POST') {
    const newScore: HighScore = {
      name: (req.body as HighScore).name,
      score: (req.body as HighScore).score,
    };
    await updateHighScores(newScore);
    res.status(201).send('Score saved');
  } else {
    res.status(405).send('Method not allowed');
  }
};
