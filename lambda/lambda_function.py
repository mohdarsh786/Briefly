import json
import uuid
import logging
from pymongo import MongoClient, errors
import google.generativeai as genai
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from concurrent.futures import ThreadPoolExecutor
import schedule
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Configure Google Generative AI
genai.configure(api_key="AIzaSyB2eLpy4AGpwaOKaG08EW2LwAIRxzW2s34")
model = genai.GenerativeModel("gemini-1.5-flash")

# MongoDB Configuration
logger.info("Connecting to MongoDB...")
client = MongoClient("mongodb+srv://arsh:qaz000@news.bp0c6.mongodb.net/?retryWrites=true&w=majority&appName=news")
db = client["news_db"]
articles_collection = db["articles"]
summarized_collection = db["summarized_articles"]
logger.info("Connected to MongoDB.")

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def summarize_article(url):
    """Summarize the article using Google Generative AI with retries."""
    logger.info(f"Summarizing article at {url}")
    prompt = (
        f"Give the answer in json format, with keys as 'summary' and 'tags'. "
        f"Summarize the given news article by accessing the given link in under 150 words. "
        f"Select relevant tags from: World News, Politics, Economy, Business, Technology, Health, Environment, "
        f"Science, Education, Sports, Entertainment, Culture, Lifestyle, Travel, Crime, Opinion, Social Issues, "
        f"Innovation, Human Rights, Weather.\n{url}"
    )
    try:
        response = model.generate_content(prompt)
        # Check if the response has candidates
        content = response._result.candidates[0].content.parts[0].text   
        # Clean content to handle JSON formatting issues
        content = content.strip()  # Remove leading/trailing whitespace
        if content.startswith("```json"):
            content = content[7:]  # Strip "```json" (7 characters)
        elif content.startswith("json\n"):
            content = content[5:]  # Strip "json\n" (5 characters)

        # Remove trailing backticks if present
        if content.endswith("```"):
            content = content[:-3]  # Remove "```" (3 characters)
        elif content.endswith("\n```"):
            content = content[:-4]  # Remove "\n```" (4 characters)

        # Final cleanup
        content = content.strip()

        print(content)
        result = json.loads(content)
        summary = result.get("summary", "Summary not available")
        tags = result.get("tags", [])
        print(tags)
        logger.info(f"Generated summary: {summary[:50]}...")  # Log first 50 chars
        return summary, tags

    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON from model response: {str(e)}")
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

        # Summarize article
        summary, tags = summarize_article(article_url)
        if not tags or summary in ["Summary not available", "Unable to generate summary"]:
            logger.info(f"Skipping article: {title}. Reason: Empty summary or tags.")
            return
         
        # Prepare document for MongoDB
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
            'language': 'en',  # Assuming English
            'imageUrl': article.get('urlToImage', ''),
            'status': 'processed',
        }
        
        # Write summarized document to MongoDB
        summarized_collection.insert_one(summarized_doc)
        # test = summarized_collection.find_one({ tags: { '$in': [ 'Technology', 'Crime', 'Sports' ] } })
        # print(test)
        logger.info(f"Article '{title}' summarized and stored in MongoDB.")
        
        # Update the original article to mark it as processed
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

# Schedule the job to run every 5 minutes
schedule.every(45).minutes.do(job)

if __name__ == "__main__":
    logger.info("Starting scheduled job...")
    while True:
        schedule.run_pending()
        time.sleep(10)  # Sleep to avoid high CPU usage
