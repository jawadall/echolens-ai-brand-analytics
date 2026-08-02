"""
Celery Configuration for Echo Lens
Handles background tasks for data fetching, NLP processing, and scheduled jobs
"""
from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'echo_lens.settings')

app = Celery('echo_lens')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps
app.autodiscover_tasks()

# Celery Beat Schedule - Periodic Tasks
app.conf.beat_schedule = {
    # Auto-fetch: check every 5 minutes which brands need a fetch
    'auto-fetch-brands': {
        'task': 'apps.data_connectors.tasks.fetch_all_brand_data',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes — task checks per-brand frequency
    },
    
    # Process sentiment analysis every 30 minutes
    'process-sentiment-analysis': {
        'task': 'apps.nlp_engine.tasks.process_pending_posts',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
    
    # Update analytics aggregations every hour
    'update-analytics-aggregations': {
        'task': 'apps.analytics.tasks.update_all_aggregations',
        'schedule': crontab(minute=15),  # Every hour at minute 15
    },
    
    # Check alert thresholds every 15 minutes
    'check-alert-thresholds': {
        'task': 'apps.analytics.tasks.check_alert_thresholds',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    
    # Generate daily summaries at midnight
    'generate-daily-summaries': {
        'task': 'apps.nlp_engine.tasks.generate_daily_summaries',
        'schedule': crontab(hour=0, minute=5),  # Daily at 00:05
    },
    
    # Cleanup old data weekly
    'cleanup-old-data': {
        'task': 'apps.analytics.tasks.cleanup_old_data',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # Sunday at 3 AM
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

