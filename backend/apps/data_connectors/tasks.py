"""
Data Fetching Pipeline for Echo Lens
Orchestrates real-time data collection from all platforms:
YouTube, Reddit, Twitter/X, News, and Facebook
"""
from celery import shared_task
from django.utils import timezone
import logging

from apps.brands.models import Brand, SocialPost, FetchLog

logger = logging.getLogger(__name__)


@shared_task(name='apps.data_connectors.tasks.fetch_all_brand_data')
def fetch_all_brand_data():
    """Smart auto-fetch: only fetch brands whose fetch interval has elapsed.
    Brands with fetch_frequency=0 (manual only) are skipped."""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    from datetime import timedelta

    brands = Brand.objects.filter(status='active')
    now = timezone.now()
    queued = 0

    for brand in brands:
        freq = brand.fetch_frequency or 0
        if freq == 0:
            continue  # Manual only — skip

        # Check if enough time has passed since last fetch
        if brand.last_fetch:
            next_fetch_at = brand.last_fetch + timedelta(minutes=freq)
            if now < next_fetch_at:
                continue  # Not time yet

        try:
            fetch_brand_data.delay(brand.id)
            queued += 1
        except Exception as e:
            logger.error(f"Error queuing fetch for brand {brand.id}: {e}")

    return f"Auto-fetch: queued {queued} brands (checked {brands.count()})"


@shared_task(name='apps.data_connectors.tasks.fetch_brand_data')
def fetch_brand_data(brand_id):
    """Fetch data for a specific brand from all configured platforms"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"

    results = {}
    total_new = 0

    # Determine which platforms to fetch
    platforms = brand.platforms if brand.platforms else ['youtube', 'reddit', 'twitter', 'news', 'facebook']

    # Filter out platforms that are disabled or missing keys
    try:
        from apps.admin_dashboard.models import SystemSetting
        from .api_key_resolver import resolve_platform_mode
        active_platforms = []
        for p in platforms:
            enabled = SystemSetting.get(f'{p}_enabled', 'true').lower() == 'true'
            if not enabled:
                logger.info(f"Skipping {p} for brand '{brand.name}' — platform disabled")
                continue

            mode, key = resolve_platform_mode(p)
            if mode == 'disabled':
                logger.info(f"Skipping {p} for brand '{brand.name}' — no API key configured")
                continue

            # Both 'internal' (scraping/AI) and 'real_api' are valid
            active_platforms.append(p)
            logger.debug(f"Platform {p} for '{brand.name}': mode={mode}")

        platforms = active_platforms
    except Exception as e:
        logger.warning(f"Could not check platform status, using all: {e}")

    # ── Run ALL platforms in PARALLEL for fast data fetching ──
    import django
    from concurrent.futures import ThreadPoolExecutor, as_completed

    platform_funcs = {
        'youtube':  lambda: fetch_youtube_data(brand),
        'reddit':   lambda: fetch_reddit_data(brand),
        'news':     lambda: fetch_news_data(brand),
        'twitter':  lambda: fetch_twitter_data(brand),
        'facebook': lambda: fetch_facebook_data(brand),
    }

    def _run_platform(platform_name):
        """Wrapper that ensures Django DB connection is available in thread."""
        try:
            django.db.connections.close_all()  # Fresh connection for each thread
            func = platform_funcs.get(platform_name)
            if func:
                new_posts, posts = func()
                # Update brand stats immediately so frontend sees new posts
                try:
                    brand.refresh_from_db()
                    brand.total_posts = brand.posts.filter(is_spam=False).count()
                    brand.save(update_fields=['total_posts'])
                except Exception:
                    pass
                return platform_name, new_posts
        except Exception as e:
            logger.error(f"Error fetching {platform_name} for {brand.name}: {e}")
            return platform_name, 0

    active = [p for p in platforms if p in platform_funcs]
    with ThreadPoolExecutor(max_workers=min(len(active), 5)) as executor:
        futures = {executor.submit(_run_platform, p): p for p in active}
        for future in as_completed(futures):
            platform_name, new_posts = future.result()
            results[platform_name] = new_posts
            total_new += new_posts

    # Update brand stats (final)
    try:
        brand.refresh_from_db()
        brand.update_stats()
        brand.update_fetch_time()
    except Exception as e:
        logger.error(f"Error updating brand stats: {e}")
        brand.total_posts = brand.posts.filter(is_spam=False).count()
        brand.save(update_fields=['total_posts'])
        brand.update_fetch_time()

    # ── Post-fetch alert check ──────────────────────────────────
    # Immediately check alerts for this brand after new data arrives
    if total_new > 0:
        try:
            from apps.analytics.tasks import check_brand_alerts
            check_brand_alerts(brand.id)
        except Exception as alert_err:
            logger.warning(f"Post-fetch alert check failed for {brand.name}: {alert_err}")

    logger.info(f"Fetch complete for {brand.name}: {total_new} new posts. Breakdown: {results}")
    return f"Fetched {total_new} new posts for {brand.name}: {results}"


def _save_posts(brand: Brand, posts_data: list, platform: str) -> int:
    """Save posts to database, deduplicate, and trigger NLP processing.
    Each post is saved independently — one failure does not affect others.
    IMPORTANT: Only saves posts that contain the brand name in their content."""
    new_posts = 0
    skipped_dup = 0
    skipped_irrelevant = 0
    errors = 0

    # Build a set of terms to check for brand relevance
    brand_name_lower = brand.name.lower()
    brand_terms = {brand_name_lower}
    # Add individual words from multi-word brand names (e.g. "Infinix" from "Infinix Mobile")
    for word in brand_name_lower.split():
        if len(word) >= 3:  # Only meaningful words
            brand_terms.add(word)
    # Add keywords too
    try:
        for kw in (brand.keywords or []):
            if kw and len(kw) >= 3:
                brand_terms.add(kw.lower())
    except Exception:
        pass

    for post_data in posts_data:
        try:
            # Validate required fields
            if not post_data.get('content') or not post_data.get('platform_id'):
                continue

            # ── Brand relevance check ──
            # Only save posts that actually mention the brand name
            content_lower = post_data['content'].lower()
            if not any(term in content_lower for term in brand_terms):
                skipped_irrelevant += 1
                continue

            # Check for duplicates
            exists = SocialPost.objects.filter(
                brand=brand,
                platform=post_data['platform'],
                platform_id=post_data['platform_id']
            ).exists()

            if exists:
                skipped_dup += 1
                continue

            # Check for excluded keywords
            content_lower = post_data.get('content', '').lower()
            if brand.excluded_keywords and any(exc.lower() in content_lower for exc in brand.excluded_keywords):
                continue

            # Ensure posted_at is set
            posted_at = post_data.get('posted_at')
            if not posted_at:
                posted_at = timezone.now()

            # Create the post (this MUST succeed independently)
            post = SocialPost.objects.create(
                brand=brand,
                platform=post_data['platform'],
                platform_id=post_data['platform_id'],
                url=post_data.get('url', ''),
                content=post_data['content'][:5000],  # Cap content length
                author_id=post_data.get('author_id', '')[:200],
                author_name=post_data.get('author_name', '')[:200],
                author_username=post_data.get('author_username', '')[:200],
                author_followers=post_data.get('author_followers', 0) or 0,
                author_verified=bool(post_data.get('author_verified', False)),
                likes=post_data.get('likes', 0) or 0,
                shares=post_data.get('shares', 0) or 0,
                comments=post_data.get('comments', 0) or 0,
                views=post_data.get('views', 0) or 0,
                has_media=bool(post_data.get('has_media', False)),
                media_urls=post_data.get('media_urls', []) or [],
                posted_at=posted_at
            )

            # Process NLP (failure here should NOT prevent the post from being saved)
            try:
                _process_post_nlp(post, brand)
            except Exception as nlp_err:
                logger.warning(f"NLP failed for {platform} post {post.id}, saving with defaults: {nlp_err}")
                post.sentiment = 'neutral'
                post.sentiment_score = 0.0
                post.is_processed = True
                post.processed_at = timezone.now()
                post.save(update_fields=['sentiment', 'sentiment_score', 'is_processed', 'processed_at'])

            new_posts += 1

        except Exception as e:
            errors += 1
            logger.error(f"Error saving {platform} post: {e}")

    logger.info(f"{platform}: saved {new_posts} new, {skipped_dup} duplicates, {skipped_irrelevant} irrelevant (no brand name), {errors} errors out of {len(posts_data)} fetched")
    return new_posts


def _process_post_nlp(post: SocialPost, brand: Brand):
    """Process a single post through the NLP pipeline"""
    try:
        from apps.nlp_engine.processor import nlp_processor
        result = nlp_processor.process(post.content, brand.get_all_keywords())

        post.content_cleaned = result.get('cleaned_text', post.content[:500])
        post.language = result.get('language', 'en')
        post.sentiment = result.get('sentiment', 'neutral')
        post.sentiment_score = result.get('sentiment_score', 0.0)
        post.sentiment_confidence = result.get('sentiment_confidence', 0.0)
        post.emotions = result.get('emotions', {})
        post.topics = result.get('topics', [])
        post.aspects = result.get('aspects', {})
        post.is_spam = result.get('is_spam', False)
        post.is_processed = True
        post.processed_at = timezone.now()
        post.save()
    except Exception as nlp_error:
        logger.warning(f"NLP processing error for post {post.id}: {nlp_error}")
        # Mark as processed with defaults
        post.content_cleaned = post.content[:500] if post.content else ''
        post.language = 'en'
        post.sentiment = 'neutral'
        post.sentiment_score = 0.0
        post.sentiment_confidence = 0.0
        post.emotions = {}
        post.topics = []
        post.aspects = {}
        post.is_spam = False
        post.is_processed = True
        post.processed_at = timezone.now()
        post.save()


def _create_fetch_log(brand: Brand, platform: str, status: str,
                      posts_fetched: int = 0, posts_new: int = 0,
                      error_message: str = '') -> FetchLog:
    """Create a fetch log entry"""
    return FetchLog.objects.create(
        brand=brand,
        platform=platform,
        status=status,
        posts_fetched=posts_fetched,
        posts_new=posts_new,
        error_message=error_message,
        completed_at=timezone.now() if status != 'started' else None,
    )


def _is_fallback_enabled() -> bool:
    """Check if legacy fallback connectors are enabled via SystemSetting."""
    try:
        from apps.admin_dashboard.models import SystemSetting
        val = SystemSetting.get('apify_fallback_enabled', 'false')
        if isinstance(val, bool):
            return val
        return str(val).lower() in ('true', '1', 'yes')
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
# Platform-Specific Fetch Functions
# ═══════════════════════════════════════════════════════════════

def fetch_youtube_data(brand: Brand) -> tuple:
    """Fetch YouTube data for a brand (incremental: only new posts since last fetch)"""
    from .youtube_connector import YouTubeConnector

    fetch_log = _create_fetch_log(brand, 'youtube', 'started')
    posts_data = []

    try:
        # Use centralized key resolver: brand → company → SuperAdmin DB → .env
        from .api_key_resolver import get_key_for_brand
        brand_yt_key = get_key_for_brand(brand, 'youtube_api_key') or get_key_for_brand(brand, 'youtube')

        connector = YouTubeConnector()
        if brand_yt_key:
            connector.api_key = brand_yt_key
            connector._initialize()
        else:
            connector._ensure_initialized()

        if not connector.is_available():
            logger.info(f"YouTube API not configured for brand {brand.name}, skipping")
            fetch_log.status = 'skipped'
            fetch_log.error_message = connector._init_error or 'YouTube API key not configured'
            fetch_log.completed_at = timezone.now()
            fetch_log.save()
            return 0, []

        keywords = brand.get_all_keywords()

        # Incremental: only fetch videos published after last successful YouTube fetch
        last_yt_fetch = FetchLog.objects.filter(
            brand=brand, platform='youtube', status='completed'
        ).order_by('-completed_at').first()

        published_after = last_yt_fetch.completed_at if last_yt_fetch else None

        posts_data = connector.search_and_collect(
            brand_keywords=keywords,
            max_videos=10,
            comments_per_video=30,
            published_after=published_after
        )

        # If incremental returned 0 and we had a time filter, retry without it
        if len(posts_data) == 0 and published_after:
            logger.info(f"YouTube: no new posts since {published_after}, retrying without time filter")
            posts_data = connector.search_and_collect(
                brand_keywords=keywords,
                max_videos=5,
                comments_per_video=15,
                published_after=None
            )

        new_posts = _save_posts(brand, posts_data, 'youtube')

        fetch_log.status = 'completed'
        fetch_log.posts_fetched = len(posts_data)
        fetch_log.posts_new = new_posts
        fetch_log.completed_at = timezone.now()
        fetch_log.save()

        return new_posts, posts_data

    except Exception as e:
        logger.error(f"YouTube fetch error: {e}")
        fetch_log.status = 'failed'
        fetch_log.error_message = str(e)
        fetch_log.completed_at = timezone.now()
        fetch_log.save()
        return 0, []


def fetch_reddit_data(brand: Brand) -> tuple:
    """Fetch Reddit data for a brand — Apify primary, legacy fallback"""
    fetch_log = _create_fetch_log(brand, 'reddit', 'started')
    posts_data = []

    try:
        keywords = brand.get_all_keywords()
        brand_name_lower = brand.name.lower()

        # Build search queries
        search_queries = [brand.name]
        for kw in keywords:
            if kw.lower() != brand_name_lower:
                search_queries.append(f'{brand.name} {kw}')

        # ── Check if business has its own REAL API keys ──
        _use_native_api = False
        try:
            from .api_key_resolver import get_key_for_brand, _is_internal_key
            brand_key = get_key_for_brand(brand, 'reddit_client_id')
            if brand_key and not _is_internal_key('reddit_client_id', brand_key):
                _use_native_api = True
                logger.info(f"Reddit: brand '{brand.name}' has real API key, using PRAW")
        except Exception:
            pass

        if _use_native_api:
            # Use native PRAW connector with business's real keys
            from .reddit_connector import RedditConnector
            connector = RedditConnector()
            search_queries = [brand.name]
            for kw in keywords:
                if kw.lower() != brand_name_lower:
                    search_queries.append(f'{brand.name} {kw}')
            for query in search_queries[:3]:
                results = connector.search_posts(query=query, limit=30, time_filter='month')
                posts_data.extend(results)
        else:
            # ── PRIMARY: Apify (SINGLE run with multiple searches) ──
            try:
                from .apify_connector import fetch_reddit_posts, _get_apify_tokens
                if _get_apify_tokens():
                    posts_data = fetch_reddit_posts(
                        brand_name=brand.name,
                        keywords=keywords[:2],
                        limit=50,
                        time_filter='month'
                    )
                    if posts_data:
                        logger.info(f"Reddit: Apify returned {len(posts_data)} posts for '{brand.name}'")
            except Exception as apify_err:
                logger.warning(f"Reddit Apify error: {apify_err}")

            # ── FALLBACK: Legacy connector (PRAW / JSON / RSS) ──
            if not posts_data and _is_fallback_enabled():
                logger.info(f"Reddit: fallback enabled, using legacy connector for '{brand.name}'")
                from .reddit_connector import reddit_connector
                for query in [brand.name]:
                    results = reddit_connector.search_posts(
                        query=query, limit=30, time_filter='month'
                    )
                    posts_data.extend(results)
            elif not posts_data:
                logger.info(f"Reddit: no data and fallback disabled for '{brand.name}'")

        # Deduplicate by platform_id
        seen = set()
        unique_posts = []
        for p in posts_data:
            if p['platform_id'] not in seen:
                unique_posts.append(p)
                seen.add(p['platform_id'])
        posts_data = unique_posts

        new_posts = _save_posts(brand, posts_data, 'reddit')

        fetch_log.status = 'completed'
        fetch_log.posts_fetched = len(posts_data)
        fetch_log.posts_new = new_posts
        fetch_log.completed_at = timezone.now()
        fetch_log.save()

        return new_posts, posts_data

    except Exception as e:
        logger.error(f"Reddit fetch error: {e}")
        fetch_log.status = 'failed'
        fetch_log.error_message = str(e)
        fetch_log.completed_at = timezone.now()
        fetch_log.save()
        return 0, []


def fetch_news_data(brand: Brand) -> tuple:
    """Fetch news articles for a brand"""
    from .news_connector import news_connector

    fetch_log = _create_fetch_log(brand, 'news', 'started')
    posts_data = []

    try:
        if not news_connector.is_available():
            logger.info("News connector not available (feedparser missing)")
            fetch_log.status = 'failed'
            fetch_log.error_message = 'feedparser not installed'
            fetch_log.completed_at = timezone.now()
            fetch_log.save()
            return 0, []

        keywords = brand.get_all_keywords()
        brand_name_lower = brand.name.lower()

        # Build search queries: always include brand name with keywords
        search_queries = [brand.name]
        for kw in keywords:
            if kw.lower() != brand_name_lower:
                search_queries.append(f'{brand.name} {kw}')

        posts_data = news_connector.search_and_collect(
            brand_keywords=search_queries[:5],
            max_articles=15
        )

        new_posts = _save_posts(brand, posts_data, 'news')

        fetch_log.status = 'completed'
        fetch_log.posts_fetched = len(posts_data)
        fetch_log.posts_new = new_posts
        fetch_log.completed_at = timezone.now()
        fetch_log.save()

        return new_posts, posts_data

    except Exception as e:
        logger.error(f"News fetch error: {e}")
        fetch_log.status = 'failed'
        fetch_log.error_message = str(e)
        fetch_log.completed_at = timezone.now()
        fetch_log.save()
        return 0, []


def fetch_twitter_data(brand: Brand, real_context: list = None) -> tuple:
    """Fetch Twitter/X posts — Apify primary, legacy fallback"""
    fetch_log = _create_fetch_log(brand, 'twitter', 'started')
    posts_data = []

    try:
        keywords = brand.get_all_keywords()
        brand_name_lower = brand.name.lower()

        # Build search queries
        search_queries = [brand.name]
        for kw in keywords:
            if kw.lower() != brand_name_lower:
                search_queries.append(f'{brand.name} {kw}')

        seen_ids = set()

        # ── Check if business has its own REAL API keys ──
        _use_native_api = False
        try:
            from .api_key_resolver import get_key_for_brand, _is_internal_key
            brand_key = get_key_for_brand(brand, 'twitter_bearer_token')
            if brand_key and not _is_internal_key('twitter', brand_key):
                _use_native_api = True
                logger.info(f"Twitter: brand '{brand.name}' has real API key, using native connector")
        except Exception:
            pass

        if _use_native_api:
            # Use native Twitter connector with business's real keys
            from .twitter_connector import twitter_connector
            search_queries = [brand.name]
            for kw in keywords:
                if kw.lower() != brand_name_lower:
                    search_queries.append(f'{brand.name} {kw}')
            for query in search_queries[:3]:
                results = twitter_connector.search_posts(query, max_results=15)
                for post in results:
                    if post['platform_id'] not in seen_ids:
                        posts_data.append(post)
                        seen_ids.add(post['platform_id'])
        else:
            # ── PRIMARY: Apify (SINGLE run with OR-combined query) ──
            try:
                from .apify_connector import fetch_twitter_posts, _get_apify_tokens
                if _get_apify_tokens():
                    results = fetch_twitter_posts(
                        brand_name=brand.name,
                        keywords=keywords[:2],
                        limit=40
                    )
                    for post in results:
                        if post['platform_id'] not in seen_ids:
                            posts_data.append(post)
                            seen_ids.add(post['platform_id'])
                    if posts_data:
                        logger.info(f"Twitter: Apify returned {len(posts_data)} tweets for '{brand.name}'")
            except Exception as apify_err:
                logger.warning(f"Twitter Apify error: {apify_err}")

            # ── FALLBACK: Legacy connector ──
            if not posts_data and _is_fallback_enabled():
                logger.info(f"Twitter: fallback enabled, using legacy connector for '{brand.name}'")
                from .twitter_connector import twitter_connector
                results = twitter_connector.search_posts(brand.name, max_results=15)
                for post in results:
                    if post['platform_id'] not in seen_ids:
                        posts_data.append(post)
                        seen_ids.add(post['platform_id'])
            elif not posts_data:
                logger.info(f"Twitter: no data and fallback disabled for '{brand.name}'")

        new_posts = _save_posts(brand, posts_data, 'twitter')

        fetch_log.status = 'completed'
        fetch_log.posts_fetched = len(posts_data)
        fetch_log.posts_new = new_posts
        fetch_log.completed_at = timezone.now()
        fetch_log.save()

        return new_posts, posts_data

    except Exception as e:
        logger.error(f"Twitter fetch error: {e}")
        fetch_log.status = 'failed'
        fetch_log.error_message = str(e)
        fetch_log.completed_at = timezone.now()
        fetch_log.save()
        return 0, []


def fetch_facebook_data(brand: Brand, real_context: list = None) -> tuple:
    """Fetch Facebook posts — Apify primary, legacy fallback"""
    fetch_log = _create_fetch_log(brand, 'facebook', 'started')
    posts_data = []

    try:
        keywords = brand.get_all_keywords()

        # ── Check if business has its own REAL API keys ──
        _use_native_api = False
        try:
            from .api_key_resolver import get_key_for_brand, _is_internal_key
            brand_key = get_key_for_brand(brand, 'facebook_access_token')
            if brand_key and not _is_internal_key('facebook', brand_key):
                _use_native_api = True
                logger.info(f"Facebook: brand '{brand.name}' has real API key, using native connector")
        except Exception:
            pass

        if _use_native_api:
            # Use native Facebook connector with business's real keys
            from .facebook_connector import facebook_connector
            posts_data = facebook_connector.generate_posts(
                brand_name=brand.name, brand_keywords=keywords, count=25
            )
        else:
            # ── PRIMARY: Apify ───────────────────────────────────
            try:
                from .apify_connector import fetch_facebook_posts, _get_apify_tokens
                if _get_apify_tokens():
                    posts_data = fetch_facebook_posts(brand.name, limit=25)
                    if posts_data:
                        logger.info(f"Facebook: Apify returned {len(posts_data)} posts for '{brand.name}'")
            except Exception as apify_err:
                logger.warning(f"Facebook Apify error: {apify_err}")

            # ── FALLBACK: Legacy connector (DuckDuckGo / Bing / Gemini) ──
            if not posts_data and _is_fallback_enabled():
                logger.info(f"Facebook: fallback enabled, using legacy connector for '{brand.name}'")
                from .facebook_connector import facebook_connector
                posts_data = facebook_connector.generate_posts(
                    brand_name=brand.name, brand_keywords=keywords, count=25
                )
            elif not posts_data:
                logger.info(f"Facebook: no data and fallback disabled for '{brand.name}'")
        new_posts = _save_posts(brand, posts_data, 'facebook')

        fetch_log.status = 'completed'
        fetch_log.posts_fetched = len(posts_data)
        fetch_log.posts_new = new_posts
        fetch_log.completed_at = timezone.now()
        fetch_log.save()

        return new_posts, posts_data

    except Exception as e:
        logger.error(f"Facebook fetch error: {e}")
        fetch_log.status = 'failed'
        fetch_log.error_message = str(e)
        fetch_log.completed_at = timezone.now()
        fetch_log.save()
        return 0, []


@shared_task(name='apps.data_connectors.tasks.fetch_single_platform')
def fetch_single_platform(brand_id: int, platform: str):
    """Fetch data from a single platform for a brand"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"

    platform_funcs = {
        'youtube': lambda: fetch_youtube_data(brand),
        'reddit': lambda: fetch_reddit_data(brand),
        'twitter': lambda: fetch_twitter_data(brand),
        'news': lambda: fetch_news_data(brand),
        'facebook': lambda: fetch_facebook_data(brand),
    }

    func = platform_funcs.get(platform)
    if not func:
        return f"Unknown platform: {platform}"

    new_posts, _ = func()
    brand.update_stats()
    return f"Fetched {new_posts} new {platform} posts for {brand.name}"
