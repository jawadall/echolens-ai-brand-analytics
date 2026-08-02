"""
News/Web Connector for Echo Lens
Fetches real news articles using Google News RSS and newspaper3k
"""
import logging
import re
import hashlib
import time
from typing import List, Dict, Optional
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


class NewsConnector:
    """Connector for Google News RSS feeds and article extraction"""

    GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q={query}&hl=en&gl=US&ceid=US:en'

    def __init__(self):
        self._feedparser = None
        self._newspaper = None
        self._init_libs()

    def _init_libs(self):
        """Initialize required libraries"""
        try:
            import feedparser
            self._feedparser = feedparser
        except ImportError:
            logger.warning("feedparser not installed. Install with: pip install feedparser")

        try:
            import newspaper
            self._newspaper = newspaper
        except ImportError:
            logger.info("newspaper3k not installed, will use RSS summaries only")

    def is_available(self) -> bool:
        return self._feedparser is not None

    def search_news(self, query: str, max_results: int = 30) -> List[Dict]:
        """
        Search Google News RSS feed for articles matching the query.
        Returns standardized post dicts.
        """
        if not self.is_available():
            logger.warning("News connector not available (feedparser missing)")
            return []

        articles = []
        import requests

        try:
            url = self.GOOGLE_NEWS_RSS.format(query=requests.utils.quote(query))
            feed = self._feedparser.parse(url)

            if feed.bozo and not feed.entries:
                logger.warning(f"RSS feed parse error: {feed.bozo_exception}")
                return []

            for entry in feed.entries[:max_results]:
                article = self._parse_rss_entry(entry)
                if article:
                    articles.append(article)

            logger.info(f"News search for '{query}' returned {len(articles)} articles")

        except Exception as e:
            logger.error(f"News search error: {e}")

        return articles

    def _parse_rss_entry(self, entry) -> Optional[Dict]:
        """Parse an RSS feed entry into a standardized post"""
        try:
            title = entry.get('title', '').strip()
            if not title:
                return None

            # Get link
            link = entry.get('link', '')

            # Get description/summary
            summary = entry.get('summary', entry.get('description', ''))
            # Clean HTML from summary
            summary = re.sub(r'<[^>]+>', ' ', summary).strip()
            summary = re.sub(r'\s+', ' ', summary)

            # Build content
            content = title
            if summary and summary != title:
                content = f"{title}\n\n{summary[:500]}"

            # Get source/publisher
            source = entry.get('source', {})
            publisher = ''
            if isinstance(source, dict):
                publisher = source.get('title', source.get('value', ''))
            elif hasattr(source, 'title'):
                publisher = source.title
            if not publisher:
                # Try to extract from title format "Article Title - Publisher"
                if ' - ' in title:
                    publisher = title.split(' - ')[-1].strip()
                    content_title = ' - '.join(title.split(' - ')[:-1]).strip()
                    content = f"{content_title}\n\n{summary[:500]}" if summary else content_title

            # Parse published date
            posted_at = timezone.now()
            published = entry.get('published', entry.get('updated', ''))
            if published:
                try:
                    from email.utils import parsedate_to_datetime
                    posted_at = parsedate_to_datetime(published)
                except (ValueError, TypeError):
                    try:
                        posted_at = datetime.fromisoformat(published.replace('Z', '+00:00'))
                    except (ValueError, TypeError):
                        pass

            # Generate unique ID
            platform_id = f"news_{hashlib.md5(link.encode()).hexdigest()[:16]}"

            return {
                'platform': 'news',
                'platform_id': platform_id,
                'url': link,
                'content': content,
                'author_id': publisher.lower().replace(' ', '_') if publisher else 'news',
                'author_name': publisher or 'News Source',
                'author_username': publisher.lower().replace(' ', '_') if publisher else 'news',
                'author_followers': 0,
                'author_verified': True,  # News sources are generally verified
                'likes': 0,
                'shares': 0,
                'comments': 0,
                'views': 0,
                'has_media': False,
                'media_urls': [],
                'posted_at': posted_at,
            }

        except Exception as e:
            logger.error(f"Error parsing RSS entry: {e}")
            return None

    def extract_article_content(self, url: str) -> Optional[str]:
        """
        Extract full article content from a URL using newspaper3k.
        Returns cleaned article text.
        """
        if not self._newspaper:
            return None

        try:
            from newspaper import Article
            article = Article(url)
            article.download()
            article.parse()

            if article.text:
                return article.text[:2000]  # Cap at 2000 chars
        except Exception as e:
            logger.debug(f"Article extraction failed for {url}: {e}")

        return None

    def search_and_collect(self, brand_keywords: List[str], max_articles: int = 20) -> List[Dict]:
        """
        Search multiple keywords and collect news articles.
        Uses RSS summaries directly (fast and reliable).
        """
        all_articles = []
        seen_ids = set()

        for keyword in brand_keywords[:5]:
            articles = self.search_news(keyword, max_results=max_articles)

            for article in articles:
                if article['platform_id'] not in seen_ids:
                    all_articles.append(article)
                    seen_ids.add(article['platform_id'])

            time.sleep(0.5)  # Be polite to Google News

        logger.info(f"News collected {len(all_articles)} total articles")
        return all_articles


# Global instance
news_connector = NewsConnector()
