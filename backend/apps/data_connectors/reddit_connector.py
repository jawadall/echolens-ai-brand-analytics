"""
Reddit Connector for Echo Lens
Fetches posts and comments from Reddit using PRAW (if configured)
or Reddit's public JSON API as fallback (no auth needed)
"""
import logging
import time
import hashlib
from typing import List, Dict, Optional
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class RedditConnector:
    """Connector for Reddit - PRAW with public JSON fallback"""

    def __init__(self):
        self.client_id = ''
        self.client_secret = ''
        self.user_agent = 'EchoLens/1.0'
        self.reddit = None
        self._praw_available = False
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy init — resolve keys from DB/env at first use, not import time"""
        if self._initialized:
            return
        self._initialized = True

        from .api_key_resolver import get_active_key
        self.client_id = get_active_key('reddit_client_id') or ''
        self.client_secret = get_active_key('reddit_client_secret') or ''
        self.user_agent = get_active_key('reddit_user_agent') or 'EchoLens/1.0'

        if self.client_id and self.client_secret:
            self._initialize_praw()

    def _initialize_praw(self):
        """Initialize PRAW Reddit instance"""
        try:
            import praw
            self.reddit = praw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent
            )
            self._praw_available = True
            logger.info("Reddit PRAW connector initialized successfully")
        except ImportError:
            logger.warning("praw not installed, will use public JSON API")
        except Exception as e:
            logger.error(f"Failed to initialize Reddit PRAW: {e}")

    def is_available(self) -> bool:
        """Reddit is always available via public JSON API"""
        return True

    def search_posts(
        self,
        query: str,
        subreddit: str = 'all',
        limit: int = 50,
        time_filter: str = 'week'
    ) -> List[Dict]:
        """Search for posts matching query"""
        self._ensure_initialized()
        if self._praw_available:
            return self._search_praw(query, subreddit, limit, time_filter)
        else:
            return self._search_json(query, limit, time_filter)

    def _search_praw(self, query: str, subreddit: str, limit: int, time_filter: str) -> List[Dict]:
        """Search using PRAW (requires API credentials)"""
        posts = []
        try:
            subreddit_obj = self.reddit.subreddit(subreddit)
            for submission in subreddit_obj.search(query, limit=limit, time_filter=time_filter):
                post_data = self._parse_praw_submission(submission)
                if post_data:
                    posts.append(post_data)
        except Exception as e:
            logger.error(f"PRAW search error: {e}")
            # Fallback to JSON
            return self._search_json(query, limit, time_filter)
        return posts

    def _search_json(self, query: str, limit: int, time_filter: str) -> List[Dict]:
        """
        Search using Reddit's public JSON API.
        Tries multiple domains: old.reddit.com → www.reddit.com → RSS fallback.
        """
        import requests

        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'DNT': '1',
            'Connection': 'keep-alive',
        })

        params = {
            'q': query,
            'limit': min(limit, 100),
            't': time_filter,
            'sort': 'relevance',
            'type': 'link',
        }

        # Try old.reddit.com first (less aggressively blocked by datacenter IPs)
        domains = ['old.reddit.com', 'www.reddit.com']

        for domain in domains:
            try:
                url = f'https://{domain}/search.json'
                resp = session.get(url, params=params, timeout=10)

                if resp.status_code == 429:
                    logger.warning(f"Reddit {domain} rate limited, waiting 3s...")
                    time.sleep(3)
                    resp = session.get(url, params=params, timeout=10)

                if resp.status_code == 200:
                    data = resp.json()
                    children = data.get('data', {}).get('children', [])
                    posts = []
                    for child in children:
                        post_data = self._parse_json_post(child.get('data', {}))
                        if post_data:
                            posts.append(post_data)

                    if posts:
                        logger.info(f"Reddit JSON ({domain}) for '{query}' returned {len(posts)} posts")
                        return posts

                logger.info(f"Reddit {domain} returned {resp.status_code}, trying next domain...")
            except requests.exceptions.Timeout:
                logger.warning(f"Reddit {domain} timed out")
            except Exception as e:
                logger.warning(f"Reddit {domain} error: {e}")

        # All JSON domains failed → try RSS with enrichment
        logger.info(f"Reddit JSON failed for '{query}', trying RSS with enrichment")
        return self._search_rss(query, limit, time_filter)

    def _search_rss(self, query: str, limit: int, time_filter: str) -> List[Dict]:
        """
        Fallback: Search Reddit via RSS feed, then enrich each post by fetching
        its individual .json endpoint to get scores/comments/full text —
        producing the same quality as the JSON search API.
        """
        import requests
        import html
        from urllib.parse import quote_plus

        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': '*/*',
        })

        posts = []

        try:
            url = f'https://www.reddit.com/search.rss?q={quote_plus(query)}&t={time_filter}&sort=relevance&limit={min(limit, 50)}'
            resp = session.get(url, timeout=10)

            if resp.status_code != 200:
                logger.warning(f"Reddit RSS returned {resp.status_code}")
                return []

            # Parse Atom XML
            import xml.etree.ElementTree as ET
            root = ET.fromstring(resp.text)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}

            entries = root.findall('.//atom:entry', ns)
            logger.info(f"Reddit RSS found {len(entries)} entries for '{query}'")

            for entry in entries:
                try:
                    title_el = entry.find('atom:title', ns)
                    link_el = entry.find("atom:link[@rel='alternate']", ns)
                    author_el = entry.find('atom:author/atom:name', ns)
                    updated_el = entry.find('atom:updated', ns)
                    content_el = entry.find('atom:content', ns)

                    title = html.unescape(title_el.text) if title_el is not None and title_el.text else ''
                    if not title or title == '[deleted by user]':
                        continue

                    link = link_el.get('href', '') if link_el is not None else ''
                    author = (author_el.text or '').replace('/u/', '') if author_el is not None else '[unknown]'

                    # Extract post ID from link
                    post_id = ''
                    if '/comments/' in link:
                        parts = link.split('/comments/')
                        if len(parts) > 1:
                            post_id = parts[1].split('/')[0]

                    if not post_id:
                        post_id = hashlib.md5(link.encode()).hexdigest()[:12]

                    # Parse timestamp
                    posted_at = timezone.now()
                    if updated_el is not None and updated_el.text:
                        try:
                            from datetime import datetime as dt_datetime
                            ts = updated_el.text.replace('Z', '+00:00')
                            posted_at = dt_datetime.fromisoformat(ts)
                        except Exception:
                            pass

                    # Extract content from HTML, properly decode entities
                    content = title
                    if content_el is not None and content_el.text:
                        import re
                        raw = html.unescape(content_el.text)
                        raw = re.sub(r'<[^>]+>', ' ', raw)
                        raw = re.sub(r'\s+', ' ', raw).strip()
                        # Remove boilerplate "submitted by /u/... to r/..."
                        raw = re.sub(r'submitted\s+by\s+/u/\S+\s+to\s+r/\S+', '', raw).strip()
                        raw = re.sub(r'\[link\]\s*\[comments\]', '', raw).strip()
                        if raw and len(raw) > len(title):
                            content = raw[:2000]

                    posts.append({
                        'platform': 'reddit',
                        'platform_id': f"reddit_{post_id}",
                        'url': link,
                        'content': content,
                        'author_id': author,
                        'author_name': author,
                        'author_username': author,
                        'author_followers': 0,
                        'author_verified': False,
                        'likes': 0,
                        'shares': 0,
                        'comments': 0,
                        'views': 0,
                        'has_media': False,
                        'media_urls': [],
                        'posted_at': posted_at,
                    })
                except Exception as parse_err:
                    logger.debug(f"RSS entry parse error: {parse_err}")
                    continue

            # Enrich posts with full data from individual .json endpoints
            if posts:
                posts = self._enrich_rss_posts(session, posts)

            logger.info(f"Reddit RSS search for '{query}' returned {len(posts)} posts (enriched)")

        except Exception as e:
            logger.error(f"Reddit RSS search error: {e}")

        return posts[:limit]

    def _enrich_rss_posts(self, session, posts: List[Dict]) -> List[Dict]:
        """
        Fetch individual post .json endpoints to get scores, comments,
        and full selftext — matching the quality of the JSON search API.
        """
        enriched = []
        for i, post in enumerate(posts):
            url = post.get('url', '')
            if not url or '/comments/' not in url:
                enriched.append(post)
                continue

            try:
                # Rate limit: 1 request per 0.5s to avoid 429
                if i > 0:
                    time.sleep(0.5)

                json_url = url.rstrip('/') + '.json'
                resp = session.get(json_url, timeout=8)

                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        post_data = data[0].get('data', {}).get('children', [{}])[0].get('data', {})
                        if post_data:
                            parsed = self._parse_json_post(post_data)
                            if parsed:
                                enriched.append(parsed)
                                continue

                # If enrichment failed, keep original RSS post
                enriched.append(post)

            except Exception as e:
                logger.debug(f"Post enrichment error for {url}: {e}")
                enriched.append(post)

        return enriched

    def get_subreddit_posts(
        self,
        subreddit: str,
        limit: int = 50,
        sort: str = 'hot'
    ) -> List[Dict]:
        """Get posts from a specific subreddit"""
        if self._praw_available:
            return self._get_subreddit_praw(subreddit, limit, sort)
        else:
            return self._get_subreddit_json(subreddit, limit, sort)

    def _get_subreddit_praw(self, subreddit: str, limit: int, sort: str) -> List[Dict]:
        """Get subreddit posts via PRAW"""
        posts = []
        try:
            sub = self.reddit.subreddit(subreddit)
            if sort == 'hot':
                submissions = sub.hot(limit=limit)
            elif sort == 'new':
                submissions = sub.new(limit=limit)
            elif sort == 'top':
                submissions = sub.top(limit=limit, time_filter='week')
            else:
                submissions = sub.hot(limit=limit)

            for submission in submissions:
                post_data = self._parse_praw_submission(submission)
                if post_data:
                    posts.append(post_data)
        except Exception as e:
            logger.error(f"PRAW subreddit error: {e}")
            return self._get_subreddit_json(subreddit, limit, sort)
        return posts

    def _get_subreddit_json(self, subreddit: str, limit: int, sort: str) -> List[Dict]:
        """Get subreddit posts via JSON API"""
        import requests

        posts = []
        try:
            url = f'https://www.reddit.com/r/{subreddit}/{sort}.json'
            params = {'limit': min(limit, 100)}
            headers = {'User-Agent': self.user_agent}

            resp = requests.get(url, params=params, headers=headers, timeout=15)
            if resp.status_code != 200:
                return []

            data = resp.json()
            children = data.get('data', {}).get('children', [])
            for child in children:
                post_data = self._parse_json_post(child.get('data', {}))
                if post_data:
                    posts.append(post_data)
        except Exception as e:
            logger.error(f"Reddit JSON subreddit error: {e}")

        return posts

    def get_post_comments(self, post_id: str, limit: int = 50) -> List[Dict]:
        """Get comments for a post"""
        if self._praw_available:
            return self._get_comments_praw(post_id, limit)
        else:
            return self._get_comments_json(post_id, limit)

    def _get_comments_praw(self, post_id: str, limit: int) -> List[Dict]:
        """Get comments via PRAW"""
        comments = []
        try:
            submission = self.reddit.submission(id=post_id)
            submission.comments.replace_more(limit=0)
            for comment in submission.comments[:limit]:
                comment_data = self._parse_praw_comment(comment)
                if comment_data:
                    comments.append(comment_data)
        except Exception as e:
            logger.error(f"PRAW comment error: {e}")
            return self._get_comments_json(post_id, limit)
        return comments

    def _get_comments_json(self, post_id: str, limit: int) -> List[Dict]:
        """Get comments via JSON API"""
        import requests

        comments = []
        try:
            url = f'https://www.reddit.com/comments/{post_id}.json'
            headers = {'User-Agent': self.user_agent}
            resp = requests.get(url, headers=headers, timeout=15)

            if resp.status_code != 200:
                return []

            data = resp.json()
            if len(data) >= 2:
                comment_children = data[1].get('data', {}).get('children', [])
                for child in comment_children[:limit]:
                    if child.get('kind') == 't1':
                        cdata = child.get('data', {})
                        body = cdata.get('body', '')
                        if body and body != '[deleted]' and body != '[removed]':
                            comments.append({
                                'platform_id': cdata.get('id', ''),
                                'content': body,
                                'author_id': cdata.get('author', '[deleted]'),
                                'author_name': cdata.get('author', '[deleted]'),
                                'likes': cdata.get('score', 0),
                                'posted_at': datetime.fromtimestamp(
                                    cdata.get('created_utc', 0),
                                    tz=dt_timezone.utc
                                ),
                            })
        except Exception as e:
            logger.error(f"Reddit JSON comment error: {e}")

        return comments

    def _parse_praw_submission(self, submission) -> Optional[Dict]:
        """Parse PRAW submission into standard format"""
        try:
            content = submission.title
            if submission.selftext:
                content = f"{submission.title}\n\n{submission.selftext}"

            return {
                'platform': 'reddit',
                'platform_id': f"reddit_{submission.id}",
                'url': f"https://reddit.com{submission.permalink}",
                'content': content,
                'author_id': str(submission.author) if submission.author else '[deleted]',
                'author_name': str(submission.author) if submission.author else '[deleted]',
                'author_username': str(submission.author) if submission.author else '[deleted]',
                'author_followers': 0,
                'author_verified': False,
                'likes': submission.score,
                'shares': 0,
                'comments': submission.num_comments,
                'views': 0,
                'has_media': bool(submission.url and not submission.is_self),
                'media_urls': [submission.url] if not submission.is_self else [],
                'posted_at': datetime.fromtimestamp(
                    submission.created_utc,
                    tz=dt_timezone.utc
                ),
            }
        except Exception as e:
            logger.error(f"Error parsing PRAW submission: {e}")
            return None

    def _parse_json_post(self, data: Dict) -> Optional[Dict]:
        """Parse Reddit JSON post into standard format"""
        try:
            title = data.get('title', '')
            selftext = data.get('selftext', '')
            if not title:
                return None

            content = title
            if selftext and selftext not in ('[removed]', '[deleted]'):
                content = f"{title}\n\n{selftext[:1000]}"

            author = data.get('author', '[deleted]')
            permalink = data.get('permalink', '')
            post_id = data.get('id', '')
            created_utc = data.get('created_utc', 0)

            try:
                posted_at = datetime.fromtimestamp(created_utc, tz=dt_timezone.utc)
            except (ValueError, OSError):
                posted_at = timezone.now()

            is_self = data.get('is_self', True)
            url_field = data.get('url', '')

            return {
                'platform': 'reddit',
                'platform_id': f"reddit_{post_id}",
                'url': f"https://reddit.com{permalink}" if permalink else '',
                'content': content,
                'author_id': author,
                'author_name': author,
                'author_username': author,
                'author_followers': 0,
                'author_verified': False,
                'likes': data.get('score', 0),
                'shares': 0,
                'comments': data.get('num_comments', 0),
                'views': 0,
                'has_media': bool(url_field and not is_self),
                'media_urls': [url_field] if (url_field and not is_self) else [],
                'posted_at': posted_at,
            }
        except Exception as e:
            logger.error(f"Error parsing Reddit JSON post: {e}")
            return None

    def _parse_praw_comment(self, comment) -> Optional[Dict]:
        """Parse PRAW comment into standard format"""
        try:
            return {
                'platform_id': comment.id,
                'content': comment.body,
                'author_id': str(comment.author) if comment.author else '[deleted]',
                'author_name': str(comment.author) if comment.author else '[deleted]',
                'likes': comment.score,
                'posted_at': datetime.fromtimestamp(
                    comment.created_utc,
                    tz=dt_timezone.utc
                ),
            }
        except Exception as e:
            logger.error(f"Error parsing PRAW comment: {e}")
            return None


# Global connector instance
reddit_connector = RedditConnector()
