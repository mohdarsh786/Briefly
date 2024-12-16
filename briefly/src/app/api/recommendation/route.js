import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { MongoClient, ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

// MongoDB configuration
const client = new MongoClient('mongodb+srv://arsh:qaz000@news.bp0c6.mongodb.net/?retryWrites=true&w=majority&appName=news');
const dbName = 'news_db';
const collectionName = 'summarized_articles';

export const GET = withApiAuthRequired(async function handler(req) {
    const session = await getSession(req);

    // Check user authentication
    if (!session || !session.user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lastKey = searchParams.get('lastKey') || null; // Pagination key
    let tags = [];
    try {
        tags = searchParams.get('tags') ? JSON.parse(searchParams.get('tags')) : [];
    } catch (error) {
        return NextResponse.json({ error: 'Invalid tags format' }, { status: 400 });
    }

    // Handle case where no tags are provided
    if (tags.length === 0) {
        return NextResponse.json({ articles: [] }, { status: 200 });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Query to fetch articles
        const query = {
            tags: { $in: tags }, // Match any of the provided tags
            ...(lastKey && { _id: { $gt: new ObjectId(lastKey) } }), // Pagination logic
        };

        const articlesCursor = collection
            .find(query)
            .sort({ publishDate: -1 }) // Sort by latest publish date
            .limit(50); // Fetch up to 50 articles

        const articlesData = await articlesCursor.toArray();

        // Randomize articles
        const randomizedArticles = articlesData
            .map(article => ({ ...article, randomKey: Math.random() })) // Assign random keys
            .sort((a, b) => a.randomKey - b.randomKey); // Sort by random key

        // Map MongoDB articles to API response format
        const articles = randomizedArticles.slice(0, 10).map(item => ({
            article_id: item._id.toString(),
            title: item.title,
            content: item.summary,
            tags: item.tags || [],
            image_url: item.imageUrl || '', // Default to empty if no image URL
            author: item.author || 'Unknown',
            published_date: item.publishDate,
            url: item.url,
        }));

        return NextResponse.json({
            articles,
            lastKey: articlesData.length === 50 ? articlesData[49]._id : null, // Update lastKey if more articles are available
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json({ error: 'Server error fetching articles' }, { status: 500 });
    } finally {
        await client.close();
    }
});
