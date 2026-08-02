"""
Celery tasks for NLP processing
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from apps.brands.models import Brand, SocialPost
from apps.analytics.models import SentimentSummary
from .processor import nlp_processor
from .gemini_client import gemini_client

logger = logging.getLogger(__name__)


@shared_task(name='apps.nlp_engine.tasks.process_pending_posts')
def process_pending_posts():
    """Process all pending (unprocessed) posts"""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    pending_posts = SocialPost.objects.filter(is_processed=False)[:500]
    
    processed = 0
    errors = 0
    
    for post in pending_posts:
        try:
            process_single_post(post.id)
            processed += 1
        except Exception as e:
            logger.error(f"Error processing post {post.id}: {e}")
            errors += 1
    
    return f"Processed {processed} posts, {errors} errors"


@shared_task(name='apps.nlp_engine.tasks.process_single_post')
def process_single_post(post_id):
    """Process a single post through NLP pipeline"""
    try:
        post = SocialPost.objects.get(id=post_id)
    except SocialPost.DoesNotExist:
        return f"Post {post_id} not found"
    
    # Get brand keywords
    brand_keywords = post.brand.get_all_keywords()
    
    # Process through NLP
    result = nlp_processor.process(post.content, brand_keywords)
    
    # Update post
    post.content_cleaned = result['cleaned_text']
    post.language = result['language']
    post.sentiment = result['sentiment']
    post.sentiment_score = result['sentiment_score']
    post.sentiment_confidence = result['sentiment_confidence']
    post.emotions = result['emotions']
    post.topics = result['topics']
    post.aspects = result['aspects']
    post.is_spam = result['is_spam']
    post.is_processed = True
    post.processed_at = timezone.now()
    post.save()
    
    return f"Processed post {post_id}: {result['sentiment']}"


@shared_task(name='apps.nlp_engine.tasks.process_brand_posts')
def process_brand_posts(brand_id):
    """Process all pending posts for a specific brand"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"
    
    pending_posts = brand.posts.filter(is_processed=False)
    
    processed = 0
    for post in pending_posts:
        try:
            process_single_post(post.id)
            processed += 1
        except Exception as e:
            logger.error(f"Error processing post {post.id}: {e}")
    
    return f"Processed {processed} posts for {brand.name}"


@shared_task(name='apps.nlp_engine.tasks.generate_brand_summary')
def generate_brand_summary(brand_id, days=7):
    """Generate AI summary for a brand"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"
    
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)
    
    # Get posts
    posts = brand.posts.filter(
        posted_at__gte=start_date,
        posted_at__lte=end_date,
        is_spam=False,
        is_processed=True
    )
    
    if posts.count() == 0:
        return f"No processed posts for {brand.name}"
    
    # Prepare posts data with all necessary fields
    posts_data = []
    for post in posts:
        posts_data.append({
            'content': post.content,
            'sentiment': post.sentiment,
            'sentiment_score': post.sentiment_score or 0.0,
            'topics': post.topics or [],
            'emotions': post.emotions or {},
            'likes': post.likes or 0,
            'shares': post.shares or 0,
            'comments': post.comments or 0,
            'views': post.views or 0,
            'platform': post.platform,
            'author_username': post.author_username or '',
            'posted_at': post.posted_at.isoformat() if post.posted_at else None,
        })
    
    # Generate summary
    summary_data = gemini_client.generate_brand_summary(
        brand.name,
        posts_data,
        days
    )
    
    # Save summary
    summary = SentimentSummary.objects.create(
        brand=brand,
        summary_type='daily' if days <= 1 else ('weekly' if days <= 7 else 'monthly'),
        start_date=start_date.date(),
        end_date=end_date.date(),
        summary_text=summary_data.get('summary', ''),
        key_insights=summary_data.get('key_insights', []),
        what_users_like=summary_data.get('what_users_like', ''),
        what_users_dislike=summary_data.get('what_users_dislike', ''),
        platform_analysis=summary_data.get('platform_analysis', ''),
        recommendations=summary_data.get('recommendations', []),
        metrics_snapshot={
            'total_posts': posts.count(),
            'positive': posts.filter(sentiment='positive').count(),
            'neutral': posts.filter(sentiment='neutral').count(),
            'negative': posts.filter(sentiment='negative').count(),
        }
    )
    
    return f"Generated summary {summary.id} for {brand.name}"


@shared_task(name='apps.nlp_engine.tasks.generate_daily_summaries')
def generate_daily_summaries():
    """Generate daily summaries for all active brands"""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    brands = Brand.objects.filter(status='active')
    
    generated = 0
    for brand in brands:
        try:
            generate_brand_summary.delay(brand.id, days=1)
            generated += 1
        except Exception as e:
            logger.error(f"Error queuing summary for brand {brand.id}: {e}")
    
    return f"Queued daily summaries for {generated} brands"


@shared_task(name='apps.nlp_engine.tasks.reprocess_posts')
def reprocess_posts(brand_id, start_date=None, end_date=None):
    """Reprocess posts for a brand (e.g., after model updates)"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"
    
    posts = brand.posts.all()
    
    if start_date:
        posts = posts.filter(posted_at__gte=start_date)
    if end_date:
        posts = posts.filter(posted_at__lte=end_date)
    
    # Reset processing status
    posts.update(is_processed=False)
    
    # Queue processing
    for post in posts:
        process_single_post.delay(post.id)
    
    return f"Queued {posts.count()} posts for reprocessing"

