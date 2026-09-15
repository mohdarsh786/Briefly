import { auth0 } from '@/lib/auth0';
import { MongoClient, ObjectId } from 'mongodb';
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

export const GET = auth0.withApiAuthRequired(async function handler(req) {
  const session = await auth0.getSession(req);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lastKey = searchParams.get('lastKey') || null;
  let tags = [];
  try {
    tags = searchParams.get('tags') ? JSON.parse(searchParams.get('tags')) : [];
  } catch (error) {
    return NextResponse.json({ error: 'Invalid tags format' }, { status: 400 });
  }

  if (tags.length === 0) {
    return NextResponse.json({ articles: [] }, { status: 200 });
  }

  try {
    const client = await connectToDatabase();
    const dbName = process.env.MONGO_DB_NAME || 'news_db';
    const collectionName = process.env.MONGO_RECOMMENDATION_COLLECTION_NAME || 'summarized_articles';
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const query = {
      tags: { $in: tags },
      ...(lastKey && { _id: { $gt: new ObjectId(lastKey) } }),
    };

    const articlesCursor = collection
      .find(query)
      .sort({ publishDate: -1 })
      .limit(50);

    const articlesData = await articlesCursor.toArray();

    const randomizedArticles = articlesData
      .map(article => ({ ...article, randomKey: Math.random() }))
      .sort((a, b) => a.randomKey - b.randomKey);

    const articles = randomizedArticles.slice(0, 10).map(item => ({
      article_id: item._id.toString(),
      title: item.title,
      content: item.summary,
      tags: item.tags || [],
      image_url: item.imageUrl || '',
      author: item.author || 'Unknown',
      published_date: item.publishDate,
      url: item.url,
    }));

    return NextResponse.json({
      articles,
      lastKey: articlesData.length === 50 ? articlesData[49]._id : null,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching articles:', error.message);
    return NextResponse.json({ error: 'Server error fetching articles' }, { status: 500 });
  }
});
