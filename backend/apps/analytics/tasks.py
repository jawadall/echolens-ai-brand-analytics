"""
Celery tasks for analytics processing
"""
from celery import shared_task
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q
from django.db.models.functions import TruncDate
from datetime import timedelta
from collections import Counter
import logging

from .models import DailyAnalytics, HourlyAnalytics, TopicTrend, PlatformAnalytics
from apps.brands.models import Brand, SocialPost, BrandAlert
from apps.accounts.models import Notification

logger = logging.getLogger(__name__)


@shared_task(name='apps.analytics.tasks.update_all_aggregations')
def update_all_aggregations():
    """Update analytics aggregations for all active brands"""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    brands = Brand.objects.filter(status='active')
    
    for brand in brands:
        try:
            update_brand_daily_analytics.delay(brand.id)
        except Exception as e:
            logger.error(f"Error queuing analytics for brand {brand.id}: {e}")
    
    return f"Queued analytics update for {brands.count()} brands"


@shared_task(name='apps.analytics.tasks.update_brand_daily_analytics')
def update_brand_daily_analytics(brand_id, date=None):
    """Update daily analytics for a specific brand"""
    try:
        brand = Brand.objects.get(id=brand_id)
    except Brand.DoesNotExist:
        return f"Brand {brand_id} not found"
    
    if date is None:
        date = timezone.now().date()
    
    # Get posts for the day
    posts = brand.posts.filter(
        posted_at__date=date,
        is_spam=False
    )
    
    processed_posts = posts.filter(is_processed=True)
    total = processed_posts.count()
    
    # Calculate metrics
    positive = processed_posts.filter(sentiment='positive').count()
    neutral = processed_posts.filter(sentiment='neutral').count()
    negative = processed_posts.filter(sentiment='negative').count()
    
    # Platform breakdown
    platform_counts = dict(posts.values('platform').annotate(
        count=Count('id')
    ).values_list('platform', 'count'))
    
    # Engagement
    engagement = posts.aggregate(
        likes=Sum('likes'),
        shares=Sum('shares'),
        comments=Sum('comments'),
        views=Sum('views')
    )
    
    # Topics
    all_topics = []
    for post in processed_posts.exclude(topics=[]):
        all_topics.extend(post.topics)
    top_topics = [{'topic': t[0], 'count': t[1]} for t in Counter(all_topics).most_common(10)]
    
    # Emotions
    emotion_totals = Counter()
    for post in processed_posts.exclude(emotions={}):
        for emotion, score in post.emotions.items():
            emotion_totals[emotion] += score
    
    # Top authors
    author_posts = posts.values('author_username', 'author_name').annotate(
        count=Count('id')
    ).order_by('-count')[:5]
    top_authors = list(author_posts)
    
    # Create or update
    analytics, created = DailyAnalytics.objects.update_or_create(
        brand=brand,
        date=date,
        defaults={
            'total_posts': posts.count(),
            'posts_by_platform': platform_counts,
            'positive_count': positive,
            'neutral_count': neutral,
            'negative_count': negative,
            'avg_sentiment_score': processed_posts.aggregate(
                avg=Avg('sentiment_score')
            )['avg'] or 0,
            'positive_ratio': positive / total if total > 0 else 0,
            'neutral_ratio': neutral / total if total > 0 else 0,
            'negative_ratio': negative / total if total > 0 else 0,
            'total_likes': engagement['likes'] or 0,
            'total_shares': engagement['shares'] or 0,
            'total_comments': engagement['comments'] or 0,
            'total_views': engagement['views'] or 0,
            'avg_engagement': (
                (engagement['likes'] or 0) + 
                (engagement['shares'] or 0) * 2 + 
                (engagement['comments'] or 0) * 3
            ) / posts.count() if posts.count() > 0 else 0,
            'top_topics': top_topics,
            'emotions_distribution': dict(emotion_totals),
            'top_authors': top_authors,
        }
    )
    
    # Update topic trends
    for topic_data in top_topics:
        TopicTrend.objects.update_or_create(
            brand=brand,
            topic=topic_data['topic'],
            date=date,
            defaults={
                'mention_count': topic_data['count'],
                'sentiment_score': processed_posts.filter(
                    topics__contains=[topic_data['topic']]
                ).aggregate(avg=Avg('sentiment_score'))['avg'] or 0
            }
        )
    
    return f"Updated analytics for {brand.name} on {date}"


def check_brand_alerts(brand_id):
    """Check alert conditions for a single brand. Called after data fetch and periodically.
    Returns number of alerts created."""
    try:
        brand = Brand.objects.get(id=brand_id, alert_enabled=True)
    except Brand.DoesNotExist:
        return 0

    alerts_created = 0
    now = timezone.now()

    # ── 1. Negative Sentiment Spike ─────────────────────────────
    recent_posts = brand.posts.filter(
        posted_at__gte=now - timedelta(hours=6),
        is_spam=False,
        is_processed=True
    )

    total = recent_posts.count()
    if total >= 3:  # Need at least 3 processed posts
        negative = recent_posts.filter(sentiment='negative').count()
        negative_ratio = negative / total

        if negative_ratio >= brand.alert_threshold:
            # Check for duplicate alert in last 6 hours
            already_exists = BrandAlert.objects.filter(
                brand=brand,
                alert_type='negative_spike',
                created_at__gte=now - timedelta(hours=6),
                is_resolved=False
            ).exists()

            if not already_exists:
                severity = 'critical' if negative_ratio >= 0.7 else 'high' if negative_ratio >= 0.5 else 'medium'
                alert_title = 'Negative Sentiment Spike Detected'
                alert_desc = (
                    f'{negative_ratio*100:.1f}% of recent posts ({negative}/{total}) have negative sentiment '
                    f'(threshold: {brand.alert_threshold*100:.0f}%)'
                )

                alert = BrandAlert.objects.create(
                    brand=brand,
                    alert_type='negative_spike',
                    severity=severity,
                    title=alert_title,
                    description=alert_desc,
                    metrics={
                        'negative_ratio': round(negative_ratio, 3),
                        'total_posts': total,
                        'negative_posts': negative,
                        'threshold': brand.alert_threshold,
                    }
                )

                # Attach related posts
                alert.related_posts.set(recent_posts.filter(sentiment='negative')[:10])

                # Notify all business users
                _notify_alert(brand, alert_title, alert_desc, 'negative_spike', severity)
                alerts_created += 1
                logger.info(f"ALERT: {brand.name} — negative spike {negative_ratio*100:.1f}%")

    # ── 2. Volume Spike ─────────────────────────────────────────
    avg_daily = brand.posts.filter(
        posted_at__gte=now - timedelta(days=7)
    ).count() / 7

    today_count = brand.posts.filter(
        posted_at__date=now.date()
    ).count()

    if avg_daily > 0 and today_count > avg_daily * 3:
        already_exists = BrandAlert.objects.filter(
            brand=brand,
            alert_type='volume_spike',
            created_at__gte=now - timedelta(hours=24),
            is_resolved=False
        ).exists()

        if not already_exists:
            multiplier = today_count / avg_daily
            severity = 'high' if multiplier >= 5 else 'medium'
            alert_title = 'Unusual Activity Volume'
            alert_desc = (
                f'Post volume today ({today_count}) is {multiplier:.1f}x higher '
                f'than the 7-day average ({avg_daily:.0f}/day)'
            )

            BrandAlert.objects.create(
                brand=brand,
                alert_type='volume_spike',
                severity=severity,
                title=alert_title,
                description=alert_desc,
                metrics={
                    'today_count': today_count,
                    'avg_daily': round(avg_daily, 1),
                    'multiplier': round(multiplier, 1),
                }
            )

            _notify_alert(brand, alert_title, alert_desc, 'volume_spike', severity)
            alerts_created += 1
            logger.info(f"ALERT: {brand.name} — volume spike {multiplier:.1f}x")

    return alerts_created


def _notify_alert(brand, title, description, alert_type, severity):
    """Send in-app + email notifications for an alert to all business users"""
    from apps.accounts.models import User as UserModel

    if brand.company:
        company_users = UserModel.objects.filter(company_ref=brand.company, is_active=True)
    else:
        company_users = UserModel.objects.filter(id=brand.user_id)

    for u in company_users:
        Notification.objects.create(
            user=u,
            type='alert',
            title=f'Alert: {brand.name}',
            message=description,
            link='/alerts'
        )

    # Email notifications
    try:
        from apps.accounts.emails import send_alert_notification_email
        if brand.alert_email:
            send_alert_notification_email(
                brand.alert_email, brand.name,
                alert_type, severity, title, description
            )
        else:
            for u in company_users:
                send_alert_notification_email(
                    u.email, brand.name,
                    alert_type, severity, title, description
                )
    except Exception as email_err:
        logger.warning(f"Alert email failed for {brand.name}: {email_err}")


@shared_task(name='apps.analytics.tasks.check_alert_thresholds')
def check_alert_thresholds():
    """Periodic task: check alert conditions across all brands with alerts enabled"""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    brands = Brand.objects.filter(status='active', alert_enabled=True)
    total_alerts = 0

    for brand in brands:
        try:
            total_alerts += check_brand_alerts(brand.id)
        except Exception as e:
            logger.error(f"Error checking alerts for brand {brand.id}: {e}")

    return f"Alert check complete: {total_alerts} new alerts across {brands.count()} brands"


@shared_task(name='apps.analytics.tasks.cleanup_old_data')
def cleanup_old_data():
    """Clean up old data based on retention settings"""
    # Check if scheduling is enabled
    try:
        from apps.admin_dashboard.models import SystemSetting
        if SystemSetting.get('scheduling_enabled', 'true').lower() != 'true':
            return 'Scheduling disabled by admin — skipped'
    except Exception:
        pass

    from django.conf import settings
    
    retention_days = settings.ECHOLENS_SETTINGS.get('DATA_RETENTION_DAYS', 90)
    cutoff_date = timezone.now() - timedelta(days=retention_days)
    
    # Delete old posts
    deleted_posts = SocialPost.objects.filter(posted_at__lt=cutoff_date).delete()
    
    # Delete old hourly analytics
    deleted_hourly = HourlyAnalytics.objects.filter(datetime__lt=cutoff_date).delete()
    
    logger.info(f"Cleanup: Deleted {deleted_posts[0]} posts and {deleted_hourly[0]} hourly records")
    
    return f"Cleanup complete: {deleted_posts[0]} posts, {deleted_hourly[0]} hourly records deleted"

