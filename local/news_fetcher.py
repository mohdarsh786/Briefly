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

# Load environment variables
load_dotenv()

NEWS_API_KEY = os.getenv('NEWS_API_KEY')  # Correct environment variable
MONGO_URI = os.getenv('MONGO_URI')  # Correct MongoDB URI environment variable
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'news_db')  # Default DB
MONGO_COLLECTION_NAME = os.getenv('MONGO_COLLECTION_NAME', 'articles')  # Default collection

# Connect to MongoDB
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logging.info("Connecting to MongoDB...")
client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]
articles_collection = db[MONGO_COLLECTION_NAME]
logging.info(f"Connected to MongoDB. Using database: {MONGO_DB_NAME}, collection: {MONGO_COLLECTION_NAME}")

# List of tags to fetch articles for
TAGS = [
    "World News", "Politics", "Economy", "Business", "Technology",
    "Health", "Environment", "Science", "Education", "Sports",
    "Entertainment", "Culture", "Lifestyle", "Travel", "Crime",
    "Opinion", "Social Issues", "Innovation", "Human Rights", "Weather"
]

BATCH_SIZE = 10  # Number of articles to fetch for each tag

# Session with retries
session = requests.Session()
retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries))

def fetch_news(tag):
    """Fetches news articles for a specific tag."""
    logging.info(f"Fetching news for tag: {tag}")
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

        response = session.get(url, params=params)
        if response.status_code != 200:
            logging.error(f"Error fetching news for tag '{tag}': {response.json()}")
            break

        data = response.json()
        fetched_articles = data.get('articles', [])
        logging.info(f"Fetched {len(fetched_articles)} articles for tag '{tag}' on page {page}.")
        articles.extend(fetched_articles)

        if len(fetched_articles) < BATCH_SIZE:
            logging.info(f"No more articles available for tag '{tag}'.")
            break

        page += 1

    logging.info(f"Total articles fetched for tag '{tag}': {len(articles)}")
    return articles[:BATCH_SIZE]

def push_to_mongodb(articles, tag):
    """Pushes new articles to MongoDB, skipping duplicates."""
    logging.info(f"Pushing articles to MongoDB for tag: {tag}")
    new_articles = []

    for article in articles:
        url = article.get("url")
        if not url:
            continue
        if not articles_collection.find_one({"url": url}):
            article.update({
                'tag': tag,
                'summary': None,  # Placeholder for future summaries
                'processed': False,  # Mark for summarization
                'insertedAt': datetime.utcnow()
            })
            new_articles.append(article)

    if new_articles:
        try:
            articles_collection.insert_many(new_articles)
            logging.info(f"Inserted {len(new_articles)} new articles into MongoDB for tag '{tag}'.")
        except errors.BulkWriteError as bwe:
            logging.error(f"Error inserting articles into MongoDB: {bwe.details}")
    else:
        logging.info(f"No new articles to insert for tag '{tag}'.")

def job():
    """Main job to fetch and store articles for all tags."""
    logging.info(f"Starting job at {datetime.now()}")
    for tag in TAGS:
        try:
            start_time = time.time()
            articles = fetch_news(tag)
            push_to_mongodb(articles, tag)
            elapsed = time.time() - start_time
            delay = max(10, random.uniform(10, 20) - elapsed)  # Ensure minimum delay of 10s
            logging.info(f"Waiting for {delay:.2f} seconds before processing next tag.")
            time.sleep(delay)
        except Exception as e:
            logging.error(f"Error processing tag '{tag}': {str(e)}")
    logging.info(f"Job completed at {datetime.now()}")

# Scheduler setup
scheduler = BackgroundScheduler()
scheduler.add_job(job, 'interval', minutes=45)
scheduler.start()

try:
    logging.info("Starting scheduled job loop...")
    while True:
        time.sleep(10)
except (KeyboardInterrupt, SystemExit):
    scheduler.shutdown()
