import { auth0 } from '@/lib/auth0';
import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

let cachedClient = null;

async function connectToDatabase() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  if (!cachedClient) {
    const client = new MongoClient(mongoUri);
    cachedClient = await client.connect();
  }
  return cachedClient;
}

export const POST = auth0.withApiAuthRequired(async (req) => {
  const session = await auth0.getSession(req);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let preferences;
  try {
    const body = await req.json();
    preferences = Array.isArray(body) ? body : body?.preferences;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!Array.isArray(preferences)) {
    return NextResponse.json({ error: 'Preferences must be an array' }, { status: 400 });
  }

  const userId = session.user.sub;

  try {
    const client = await connectToDatabase();
    const dbName = process.env.MONGO_DB_NAME || 'news_db';
    const collectionName = process.env.MONGO_PREFERENCES_COLLECTION_NAME || 'user_preferences';
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    await collection.updateOne(
      { userId },
      { $set: { userId, preferences } },
      { upsert: true }
    );

    return NextResponse.json({ message: 'Preferences saved' }, { status: 200 });
  } catch (error) {
    console.error('Error saving preferences:', error.message);
    return NextResponse.json({ error: 'Server error saving preferences' }, { status: 500 });
  }
});

export const GET = auth0.withApiAuthRequired(async (req) => {
  const session = await auth0.getSession(req);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.sub;

  try {
    const client = await connectToDatabase();
    const dbName = process.env.MONGO_DB_NAME || 'news_db';
    const collectionName = process.env.MONGO_PREFERENCES_COLLECTION_NAME || 'user_preferences';
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const userPreferences = await collection.findOne({ userId });

    if (!userPreferences) {
      return NextResponse.json({ preferences: [] }, { status: 200 });
    }

    return NextResponse.json({ preferences: userPreferences.preferences }, { status: 200 });
  } catch (error) {
    console.error('Error fetching preferences:', error.message);
    return NextResponse.json({ error: 'Server error fetching preferences' }, { status: 500 });
  }
});
