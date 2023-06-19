import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

interface HighScore {
  name: string;
  score: number;
}

async function getDb(): Promise<MongoClient> {
  // use different database connection strings depending on the environment
  const connectionString =
    process.env.NODE_ENV === 'production'
      ? process.env.MONGODB_URI
      : 'mongodb://localhost:27017/';
  if (!connectionString) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  const client = new MongoClient(connectionString);
  await client.connect();

  return client;
}

export async function getHighScores(): Promise<HighScore[]> {
  const client = await getDb();
  try {
    const collection = client
      .db('geoasteroids')
      .collection<HighScore>('highscores');
    const highScores = await collection
      .find()
      .sort({ score: -1 })
      .limit(10)
      .toArray(); // get the top 10 scores
    return highScores;
  } finally {
    await client.close();
  }
}

export async function updateHighScores(newScore: HighScore): Promise<void> {
  const client = await getDb();
  try {
    const collection = client.db('geoasteroids').collection('highscores');

    await collection.insertOne(newScore);

    // Remove scores that are not in the top 10
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
