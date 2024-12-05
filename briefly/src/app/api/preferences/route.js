import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://arsh:qaz000@news.bp0c6.mongodb.net/?retryWrites=true&w=majority&appName=news', { useNewUrlParser: true, useUnifiedTopology: true });
const dbName = 'news_db';
const collectionName = 'user_preferences';

let cachedClient = null;

async function connectToDatabase() {
  if (!cachedClient) {
    cachedClient = await client.connect();
  }
  return cachedClient;
}

export const POST = withApiAuthRequired(async (req) => {
  const session = await getSession(req);
  if (!session || !session.user || !session.user.sub) {
    return new Response(JSON.stringify({ error: 'User is not authenticated' }), { status: 401 });
  }

  let preferences;
  try {
    preferences = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
  }

  if (!Array.isArray(preferences) || preferences.some(p => typeof p !== 'string')) {
    return new Response(JSON.stringify({ error: 'Preferences must be an array of strings' }), { status: 400 });
  }

  const userId = session.user.sub;

  try {
    await connectToDatabase();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const existingUser = await collection.findOne({ user_id: userId });
    if (existingUser) {
      await collection.updateOne({ user_id: userId }, { $set: { preferences } });
    } else {
      await collection.insertOne({ user_id: userId, preferences });
    }

    return new Response(JSON.stringify({ message: 'Preferences saved' }), { status: 200 });
  } catch (error) {
    console.error('Error saving preferences:', error);
    return new Response(JSON.stringify({ error: 'Could not save preferences' }), { status: 500 });
  }
});

export const GET = withApiAuthRequired(async (req) => {
  const session = await getSession(req);
  if (!session || !session.user || !session.user.sub) {
    return new Response(JSON.stringify({ error: 'User is not authenticated' }), { status: 401 });
  }

  const userId = session.user.sub;

  try {
    await connectToDatabase();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const user = await collection.findOne({ user_id: userId });
    const preferences = user ? user.preferences || [] : [];
    return new Response(JSON.stringify({ preferences }), { status: 200 });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return new Response(JSON.stringify({ error: 'Could not fetch preferences' }), { status: 500 });
  }
});
