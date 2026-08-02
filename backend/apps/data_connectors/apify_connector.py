"""
Apify Connector for Echo Lens
==============================
Uses Apify Actors to fetch real social media data from Reddit, Twitter/X,
and Facebook. Supports multi-account API key rotation for maximising
the free-tier $5/month credit across multiple Apify accounts.

Recommended Actors (chosen for reliability, user base, and cost):
  - Reddit:   trudax/reddit-scraper-lite  ($3.40/1k results, 20K users)
  - Twitter:  gentle_cloud/twitter-tweets-scraper (CU only, 4.5K users, ★5.0)
  - Facebook: apify/facebook-search-scraper (keyword search, no login needed)
"""
import logging
import hashlib
import random
from typing import List, Dict, Optional
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# Actor IDs — change here if you want to swap actors later
# ═══════════════════════════════════════════════════════════════
ACTOR_REDDIT = 'trudax/reddit-scraper-lite'
ACTOR_TWITTER = 'xquik/x-tweet-scraper'
ACTOR_FACEBOOK = 'powerai/facebook-post-search-scraper'


def _get_apify_tokens() -> List[str]:
    """
    Load Apify API tokens from SystemSetting DB.
    Tokens are stored comma-separated in a single setting: 'apify_api_tokens'
    Falls back to environment variable APIFY_API_TOKENS.
    """
    tokens = []

    # 1. Try SystemSetting DB
    try:
        from apps.admin_dashboard.models import SystemSetting
        raw = SystemSetting.get('apify_api_tokens', '')
        if raw:
            tokens = [t.strip() for t in raw.split(',') if t.strip()]
    except Exception:
        pass

    # 2. Fallback to environment
    if not tokens:
        import os
        raw = os.environ.get('APIFY_API_TOKENS', '')
        if raw:
            tokens = [t.strip() for t in raw.split(',') if t.strip()]

    return tokens


def _call_actor(actor_id: str, run_input: dict, timeout_secs: int = 180) -> List[Dict]:
    """
    Call an Apify actor with automatic token rotation.
    Tries each token until one succeeds with results. Returns list of result items.
    """
    try:
        from apify_client import ApifyClient
    except ImportError:
        logger.error("apify-client not installed. Run: pip install apify-client")
        return []

    tokens = _get_apify_tokens()
    if not tokens:
        logger.warning("No Apify API tokens configured — skipping Apify fetch")
        return []

    # Shuffle to distribute load across accounts
    shuffled = list(tokens)
    random.shuffle(shuffled)

    last_error = None
    for token in shuffled:
        try:
            client = ApifyClient(token)
            logger.info(f"Apify: calling {actor_id} with token ...{token[-6:]}")
            run = client.actor(actor_id).call(
                run_input=run_input,
                timeout_secs=timeout_secs,
            )
            items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
            logger.info(f"Apify: {actor_id} returned {len(items)} items")

            # ── Detect free-tier exhaustion (actor succeeds but returns 0) ──
            if len(items) == 0:
                run_status_msg = (run.get('statusMessage') or '').lower()
                # Also check the run log for limit messages
                try:
                    log_text = client.run(run["id"]).get_log() or ''
                    log_tail = log_text[-500:].lower() if log_text else ''
                except Exception:
                    log_tail = ''

                limit_keywords = ['free user call limit', 'limit reached', 'upgrade to a paying',
                                  'billing', 'quota exceeded', 'credit', 'exceeded']
                if any(kw in run_status_msg or kw in log_tail for kw in limit_keywords):
                    logger.warning(f"Apify token ...{token[-6:]} free tier exhausted for {actor_id}, trying next")
                    continue

            return items
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            # If credit/limit exhausted, try next token
            if any(kw in error_str for kw in ('limit', 'credit', 'quota', 'billing', '402', '429')):
                logger.warning(f"Apify token ...{token[-6:]} exhausted for {actor_id}, trying next")
                continue
            # For other errors (actor not found, input error, etc.), don't retry
            logger.error(f"Apify actor {actor_id} error: {e}")
            return []

    logger.error(f"All Apify tokens exhausted for {actor_id}. Last error: {last_error}")
    return []


# ═══════════════════════════════════════════════════════════════
# Reddit
# ═══════════════════════════════════════════════════════════════

def fetch_reddit_posts(brand_name: str, keywords: List[str] = None,
                       limit: int = 50, time_filter: str = 'month') -> List[Dict]:
    """
    Fetch Reddit posts for a brand via a SINGLE Apify run.
    The actor supports multiple search terms in one call.
    Returns list of dicts in Echo Lens SocialPost format.
    """
    # Build searches: brand name + brand+keyword combos
    searches = [brand_name]
    if keywords:
        for kw in keywords[:2]:  # Limit to 2 extra keywords
            combo = f"{brand_name} {kw}"
            if combo not in searches:
                searches.append(combo)

    run_input = {
        "searches": searches,         # Multiple searches in ONE run
        "maxItems": limit,
        "maxPostCount": limit,
        "maxComments": 0,              # Don't fetch comments to save credits
        "searchPosts": True,
        "searchComments": False,
        "skipComments": True,
        "sort": "new",
        "time": time_filter,           # hour, day, week, month, year, all
        "proxy": {"useApifyProxy": True},
    }

    items = _call_actor(ACTOR_REDDIT, run_input, timeout_secs=120)
    return [_normalize_reddit(item) for item in items if _normalize_reddit(item)]


def _normalize_reddit(item: dict) -> Optional[Dict]:
    """Convert Apify Reddit item to Echo Lens SocialPost format."""
    try:
        data_type = item.get('dataType', 'post')
        if data_type not in ('post', 'comment'):
            return None

        # Build content: title + body for posts, just body for comments
        title = item.get('title', '') or ''
        body = item.get('body', '') or ''
        content = f"{title}\n{body}".strip() if title else body.strip()

        if not content:
            return None

        platform_id = item.get('parsedId') or item.get('id', '')
        if not platform_id:
            platform_id = hashlib.md5(content[:200].encode()).hexdigest()

        url = item.get('url', '')

        # Parse date
        posted_at = None
        created_str = item.get('createdAt', '')
        if created_str:
            try:
                posted_at = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        if not posted_at:
            posted_at = timezone.now()

        return {
            'platform': 'reddit',
            'platform_id': f"reddit_{platform_id}",
            'url': url,
            'content': content[:5000],
            'author_id': item.get('username', ''),
            'author_name': item.get('username', ''),
            'author_username': item.get('username', ''),
            'author_followers': 0,
            'author_verified': False,
            'likes': item.get('upVotes', 0) or 0,
            'shares': 0,
            'comments': item.get('numberOfComments', 0) or 0,
            'views': 0,
            'has_media': bool(item.get('isVideo', False)),
            'media_urls': [],
            'posted_at': posted_at,
        }
    except Exception as e:
        logger.warning(f"Error normalizing Reddit item: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# Twitter / X
# ═══════════════════════════════════════════════════════════════

def fetch_twitter_posts(brand_name: str, keywords: List[str] = None,
                        limit: int = 40) -> List[Dict]:
    """
    Fetch tweets for a brand via xquik/x-tweet-scraper.
    Uses searchTerms for proper keyword-based search.
    Returns list of dicts in Echo Lens SocialPost format.
    """
    run_input = {
        "searchTerms": [brand_name],
        "maxItems": limit,
    }

    items = _call_actor(ACTOR_TWITTER, run_input, timeout_secs=120)
    return [_normalize_twitter(item) for item in items if _normalize_twitter(item)]


def _normalize_twitter(item: dict) -> Optional[Dict]:
    """Convert Apify Twitter item to Echo Lens SocialPost format.
    
    xquik/x-tweet-scraper returns:
      text, id, url, createdAt, likeCount, retweetCount,
      replyCount, viewCount, author: {id, username, name, followers, isVerified}
    """
    try:
        content = (
            item.get('text')
            or item.get('full_text')
            or item.get('tweet_text')
            or item.get('content')
            or ''
        )
        if not content:
            return None

        # Platform ID
        tweet_id = (
            item.get('id')
            or item.get('id_str')
            or item.get('tweet_id')
            or ''
        )
        if not tweet_id:
            tweet_id = hashlib.md5(content[:200].encode()).hexdigest()

        # URL
        url = item.get('url') or item.get('twitterUrl') or ''

        # Author — xquik nests under author.username, author.name
        author = item.get('author', {}) or {}
        author_name = author.get('name') or item.get('user_name') or ''
        author_username = author.get('username') or author.get('screen_name') or ''
        author_followers = author.get('followers') or author.get('followers_count') or 0
        author_verified = author.get('isVerified') or author.get('isBlueVerified') or False

        # Engagement
        likes = item.get('likeCount') or item.get('favorite_count') or 0
        shares = item.get('retweetCount') or item.get('retweet_count') or 0
        comments = item.get('replyCount') or item.get('reply_count') or 0
        views = item.get('viewCount') or item.get('views_count') or 0

        # Date — Twitter format: "Mon May 04 07:45:00 +0000 2026"
        posted_at = None
        created_str = item.get('createdAt') or item.get('created_at') or item.get('date') or ''
        if created_str:
            try:
                posted_at = datetime.strptime(created_str, '%a %b %d %H:%M:%S %z %Y')
            except (ValueError, TypeError):
                try:
                    posted_at = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    pass
        if not posted_at:
            posted_at = timezone.now()

        return {
            'platform': 'twitter',
            'platform_id': f"tw_{tweet_id}",
            'url': url,
            'content': content[:5000],
            'author_id': str(author.get('id', '')) or str(author_username),
            'author_name': author_name,
            'author_username': author_username,
            'author_followers': int(author_followers) if author_followers else 0,
            'author_verified': bool(author_verified),
            'likes': int(likes) if likes else 0,
            'shares': int(shares) if shares else 0,
            'comments': int(comments) if comments else 0,
            'views': int(views) if views else 0,
            'has_media': bool(item.get('media')),
            'media_urls': [],
            'posted_at': posted_at,
        }
    except Exception as e:
        logger.warning(f"Error normalizing Twitter item: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# Facebook
# ═══════════════════════════════════════════════════════════════

def fetch_facebook_posts(brand_name: str, limit: int = 30) -> List[Dict]:
    """
    Fetch Facebook posts about a brand via Apify.
    Uses powerai/facebook-post-search-scraper for keyword-based post search.
    Returns list of dicts in Echo Lens SocialPost format.
    """
    run_input = {
        "query": brand_name,
        "maxResults": max(limit, 10),  # API min is 10
    }

    items = _call_actor(ACTOR_FACEBOOK, run_input, timeout_secs=120)
    return [_normalize_facebook(item) for item in items if _normalize_facebook(item)]


def _normalize_facebook(item: dict) -> Optional[Dict]:
    """Convert Apify Facebook item to Echo Lens SocialPost format.
    
    powerai/facebook-post-search-scraper returns:
      message, post_id, url, timestamp (seconds), reactions_count,
      comments_count, reshare_count, author: {id, name, url}, image/video
    """
    try:
        content = (
            item.get('message')
            or item.get('postText')
            or item.get('text')
            or item.get('description')
            or ''
        )
        if not content:
            return None

        # Platform ID
        post_id = item.get('post_id') or item.get('postId') or item.get('id') or ''
        if not post_id:
            post_id = hashlib.md5(content[:200].encode()).hexdigest()

        # URL
        url = item.get('url') or item.get('postUrl') or ''

        # Author
        author = item.get('author', {}) or {}
        if isinstance(author, str):
            page_name = author
            author_id = author
        else:
            page_name = author.get('name') or item.get('author_title') or ''
            author_id = str(author.get('id', '')) or str(page_name)

        # Engagement
        likes = item.get('reactions_count') or item.get('reactionsCount') or item.get('likes') or 0
        shares = item.get('reshare_count') or item.get('sharesCount') or item.get('shares') or 0
        comments = item.get('comments_count') or item.get('commentsCount') or item.get('comments') or 0
        views = item.get('viewsCount') or item.get('views') or 0

        # Date — timestamp in seconds (Unix epoch)
        posted_at = None
        ts = item.get('timestamp')
        if ts:
            try:
                ts_seconds = ts / 1000 if ts > 1e12 else ts
                posted_at = datetime.fromtimestamp(ts_seconds, tz=dt_timezone.utc)
            except (ValueError, TypeError, OSError):
                pass
        if not posted_at:
            time_str = item.get('scrapedAt') or item.get('date') or item.get('createdAt') or ''
            if time_str:
                try:
                    posted_at = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    pass
        if not posted_at:
            posted_at = timezone.now()

        return {
            'platform': 'facebook',
            'platform_id': f"fb_{post_id}",
            'url': url,
            'content': content[:5000],
            'author_id': author_id,
            'author_name': page_name,
            'author_username': page_name,
            'author_followers': 0,
            'author_verified': False,
            'likes': int(likes) if likes else 0,
            'shares': int(shares) if shares else 0,
            'comments': int(comments) if comments else 0,
            'views': int(views) if views else 0,
            'has_media': bool(item.get('image') or item.get('video') or item.get('attachments')),
            'media_urls': [],
            'posted_at': posted_at,
        }
    except Exception as e:
        logger.warning(f"Error normalizing Facebook item: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# Health check / diagnostics
# ═══════════════════════════════════════════════════════════════

def check_apify_status() -> Dict:
    """
    Check Apify connectivity and token status.
    Returns a summary of all configured tokens.
    """
    tokens = _get_apify_tokens()
    if not tokens:
        return {
            'available': False,
            'message': 'No Apify API tokens configured',
            'accounts': 0,
        }

    try:
        from apify_client import ApifyClient
    except ImportError:
        return {
            'available': False,
            'message': 'apify-client package not installed (pip install apify-client)',
            'accounts': len(tokens),
        }

    valid = 0
    for token in tokens:
        try:
            client = ApifyClient(token)
            # A simple API call to check token validity
            user_info = client.user().get()
            if user_info:
                valid += 1
        except Exception:
            pass

    return {
        'available': valid > 0,
        'message': f'{valid}/{len(tokens)} Apify accounts active',
        'accounts': len(tokens),
        'active_accounts': valid,
    }
