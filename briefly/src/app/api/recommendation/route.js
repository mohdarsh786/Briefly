import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

const client = new MongoClient('mongodb+srv://arsh:qaz000@news.bp0c6.mongodb.net/?retryWrites=true&w=majority&appName=news');
const dbName = 'news_db';
const collectionName = 'summarized_articles';

export const GET = withApiAuthRequired(async function handler(req) {
    const session = await getSession(req);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const userId = session.user.sub;
    const { searchParams } = new URL(req.url);
    const lastKey = searchParams.get('lastKey') || null;
    const tags = searchParams.get('tags') ? JSON.parse(searchParams.get('tags')) : [];

    if (tags.length === 0) {
        return NextResponse.json({ articles: [] }, { status: 200 });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Build query for tags and pagination
        const query = {
            tags: { $in: tags },
            ...(lastKey && { _id: { $gt: lastKey } }),
        };

        const articlesCursor = collection
            .find(query)
            .sort({ _id: 1 }) // Consistent ordering for pagination
            .limit(50); // Fetch more articles for better randomization

        const articlesData = await articlesCursor.toArray();

        // Randomize articles
        const shuffledArticles = articlesData
            .map((article) => ({ article, sortKey: Math.random() }))
            .sort((a, b) => a.sortKey - b.sortKey)
            .map(({ article }) => article);

        // Map articles to the expected format
        const articles = shuffledArticles.slice(0, 10).map(item => ({
            article_id: item._id.toString(),
            title: item.title,
            content: item.summary,
            tags: item.tags || [],
            image_url: item.imageUrl,
            author: item.author,
            published_date: item.publishDate,
            url: item.url,
        }));

        return NextResponse.json({
            articles,
            lastKey: articlesData.length === 50 ? articlesData[49]._id : null,
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return NextResponse.json({ error: 'Error fetching recommendations' }, { status: 500 });
    } finally {
        await client.close();
    }
});
