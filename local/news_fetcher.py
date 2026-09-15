import os
from dotenv import load_dotenv
import requests
import time
import urllib.parse
from pymongo import MongoClient, errors
from datetime import datetime
import random
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logging.info("Initializing application...")

load_dotenv()
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'news_db')
MONGO_COLLECTION_NAME = os.getenv('MONGO_ARTICLES_COLLECTION_NAME') or os.getenv('MONGO_COLLECTION_NAME', 'articles')

if not NEWS_API_KEY:
    logging.error("NEWS_API_KEY is missing from environment variables!")
    raise ValueError("Missing NEWS_API_KEY")
if not MONGO_URI:
    logging.error("MONGO_URI is missing from environment variables!")
    raise ValueError("Missing MONGO_URI")

logging.info("Connecting to MongoDB...")
try:
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    articles_collection = db[MONGO_COLLECTION_NAME]
    logging.info(f"Connected to MongoDB: Database={MONGO_DB_NAME}, Collection={MONGO_COLLECTION_NAME}")
except Exception as e:
    logging.critical(f"Failed to connect to MongoDB: {str(e)}")
    raise

TAGS = [
    "World News", "Politics", "Economy", "Business", "Technology",
    "Health", "Environment", "Science", "Education", "Sports",
    "Entertainment", "Culture", "Lifestyle", "Travel", "Crime",
    "Opinion", "Social Issues", "Innovation", "Human Rights", "Weather"
]
BATCH_SIZE = 10

session = requests.Session()
retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries))
logging.info("HTTP session configured with retries.")

def fetch_news(tag):
    """Fetches news articles for a specific tag."""
    logging.info(f"Fetching news for tag: '{tag}'")
    articles = []
    page = 1

    while len(articles) < BATCH_SIZE:
        url = 'https://newsapi.org/v2/everything'
        params = {
            'q': tag,
            'language': 'en',
            'sortBy': 'publishedAt',
            'pageSize': BATCH_SIZE,
            'page': page,
            'apiKey': NEWS_API_KEY
        }

        try:
            response = session.get(url, params=params)
            if response.status_code != 200:
                logging.error(f"HTTP error for tag '{tag}': {response.status_code} {response.text}")
                break

            data = response.json()
            fetched_articles = data.get('articles', [])
            logging.info(f"Fetched {len(fetched_articles)} articles for tag '{tag}' on page {page}.")
            articles.extend(fetched_articles)

            if len(fetched_articles) < BATCH_SIZE:
                logging.info(f"No more articles available for tag '{tag}'.")
                break

            page += 1
        except Exception as e:
            logging.error(f"Error fetching news for tag '{tag}': {str(e)}")
            break

    logging.info(f"Total articles fetched for tag '{tag}': {len(articles)}")
    return articles[:BATCH_SIZE]

def push_to_mongodb(articles, tag):
    """Pushes new articles to MongoDB, skipping duplicates."""
    logging.info(f"Pushing articles to MongoDB for tag: '{tag}'")
    new_articles = []

    for article in articles:
        url = article.get("url")
        if not url:
            logging.warning(f"Article without URL skipped: {article}")
            continue
        if not articles_collection.find_one({"url": url}):
            article.update({
                'tag': tag,
                'summary': None,
                'processed': False,
                'insertedAt': datetime.utcnow()
            })
            new_articles.append(article)

    if new_articles:
        try:
            articles_collection.insert_many(new_articles)
            logging.info(f"Inserted {len(new_articles)} new articles into MongoDB for tag '{tag}'.")
        except errors.BulkWriteError as bwe:
            logging.error(f"BulkWriteError: {bwe.details}")
    else:
        logging.info(f"No new articles to insert for tag '{tag}'.")

def job():
    """Main job to fetch and store articles for all tags."""
    logging.info("Starting job.")
    for tag in TAGS:
        try:
            start_time = time.time()
            articles = fetch_news(tag)
            push_to_mongodb(articles, tag)
            elapsed = time.time() - start_time
            delay = max(10, random.uniform(10, 20) - elapsed)
            logging.info(f"Processed tag '{tag}' in {elapsed:.2f} seconds. Waiting {delay:.2f} seconds.")
            time.sleep(delay)
        except Exception as e:
            logging.error(f"Error processing tag '{tag}': {str(e)}")
    logging.info("Job completed.")

scheduler = BackgroundScheduler()
scheduler.add_job(job, 'interval', minutes=45)
scheduler.start()
logging.info("Scheduler started.")

try:
    logging.info("Entering main loop. Press Ctrl+C to exit.")
    while True:
        time.sleep(10)
except (KeyboardInterrupt, SystemExit):
    logging.info("Shutting down scheduler.")
    scheduler.shutdown()
