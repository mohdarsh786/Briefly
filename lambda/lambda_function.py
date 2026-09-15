import json
import uuid
import logging
import os
from pymongo import MongoClient, errors
from google import genai
from google.genai import types
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from concurrent.futures import ThreadPoolExecutor
import schedule
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Configure Google GenAI
gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured")

model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
genai_client = genai.Client(api_key=gemini_api_key)

# MongoDB Configuration
logger.info("Connecting to MongoDB...")
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise RuntimeError("MONGO_URI is not configured")

mongo_db_name = os.getenv("MONGO_DB_NAME", "news_db")
articles_collection_name = os.getenv("MONGO_ARTICLES_COLLECTION_NAME", "articles")
summarized_collection_name = os.getenv("MONGO_SUMMARIZED_COLLECTION_NAME", "summarized_articles")

mongo_client = MongoClient(mongo_uri)
db = mongo_client[mongo_db_name]
articles_collection = db[articles_collection_name]
summarized_collection = db[summarized_collection_name]
logger.info("Connected to MongoDB.")

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def summarize_article(url):
    """Summarize the article using Gemini with retries."""
    logger.info(f"Summarizing article at {url} using model {model_name}")
    prompt = (
        f"Give the answer in json format, with keys as 'summary' and 'tags'. "
        f"Summarize the given news article by accessing the given link in under 150 words. "
        f"Select relevant tags from: World News, Politics, Economy, Business, Technology, Health, Environment, "
        f"Science, Education, Sports, Entertainment, Culture, Lifestyle, Travel, Crime, Opinion, Social Issues, "
        f"Innovation, Human Rights, Weather.\n{url}"
    )
    try:
        response = genai_client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

        content = response.text
        if not content:
            raise ValueError(
                f"Empty response received from Gemini model '{model_name}'. "
                "Check that the model name is valid and the API key has access."
            )

        # Strip any residual markdown fences (defensive: response_mime_type should prevent them)
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        result = json.loads(content)
        summary = result.get("summary", "Summary not available")
        tags = result.get("tags", [])
        logger.info(f"Generated summary ({len(summary)} chars), tags: {tags}")
        return summary, tags

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error from model response: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error summarizing article at {url}: {str(e)}")
        raise


def process_article(article):
    """Processes a single article, summarizes it, and updates MongoDB."""
    try:
        article_url = article['url']
        title = article.get('title', 'Untitled')
        author = article.get('author', 'Unknown')
        publish_date = article.get('publishedAt', datetime.utcnow().isoformat())
        publish_timestamp = int(datetime.fromisoformat(publish_date.replace('Z', '+00:00')).timestamp() * 1000)

        summary, tags = summarize_article(article_url)
        if not tags or summary in ["Summary not available", "Unable to generate summary"]:
            logger.info(f"Skipping article: {title}. Reason: Empty summary or tags.")
            return

        summarized_doc = {
            '_id': str(uuid.uuid4()),
            'messageProcessedTimestamp': int(datetime.now().timestamp() * 1000),
            'url': article_url,
            'summary': summary,
            'tags': tags,
            'title': title,
            'author': author,
            'publishDate': publish_timestamp,
            'contentLength': len(summary),
            'language': 'en',
            'imageUrl': article.get('urlToImage', ''),
            'status': 'processed',
        }

        summarized_collection.insert_one(summarized_doc)
        logger.info(f"Article '{title}' summarized and stored in MongoDB.")

        articles_collection.update_one(
            {"_id": article["_id"]}, 
            {"$set": {"summary": summary, "processed": True}}
        )
    except Exception as e:
        logger.error(f"Error processing article '{article.get('title', 'Untitled')}': {str(e)}")

def process_articles():
    """Processes unsummarized articles stored in MongoDB."""
    logger.info("Fetching unsummarized articles from MongoDB...")
    unsummarized_articles = articles_collection.find({"processed": False})
    total_unsummarized = articles_collection.count_documents({"processed": False})
    logger.info(f"Found {total_unsummarized} unsummarized articles.")

    if total_unsummarized == 0:
        logger.info("No unsummarized articles found. Exiting.")
        return
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(process_article, unsummarized_articles)

def job():
    """Job to process articles periodically."""
    logger.info("Starting article processing job...")
    process_articles()
    logger.info("Article processing job completed.")

schedule.every(45).minutes.do(job)

if __name__ == "__main__":
    logger.info("Starting scheduled job...")
    while True:
        schedule.run_pending()
        time.sleep(10)
