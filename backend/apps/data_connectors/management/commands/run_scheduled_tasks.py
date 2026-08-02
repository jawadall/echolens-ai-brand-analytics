"""
Run all scheduled tasks synchronously — alternative to Celery when Redis is unavailable.

Usage:
    python manage.py run_scheduled_tasks
    python manage.py run_scheduled_tasks --task fetch
    python manage.py run_scheduled_tasks --task nlp
    python manage.py run_scheduled_tasks --task analytics
    python manage.py run_scheduled_tasks --task alerts
"""
from django.core.management.base import BaseCommand
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run scheduled tasks synchronously (no Redis/Celery needed)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--task', type=str, default='all',
            choices=['all', 'fetch', 'nlp', 'analytics', 'alerts', 'summaries'],
            help='Which task group to run (default: all)'
        )

    def handle(self, *args, **options):
        task = options['task']

        self.stdout.write(self.style.NOTICE('═' * 50))
        self.stdout.write(self.style.NOTICE(' Echo Lens — Synchronous Task Runner'))
        self.stdout.write(self.style.NOTICE('═' * 50))

        if task in ('all', 'fetch'):
            self._run_task('Auto-fetch brands', self._fetch_brands)

        if task in ('all', 'nlp'):
            self._run_task('Process pending posts (NLP)', self._process_posts)

        if task in ('all', 'analytics'):
            self._run_task('Update analytics aggregations', self._update_analytics)

        if task in ('all', 'alerts'):
            self._run_task('Check alert thresholds', self._check_alerts)

        if task in ('all', 'summaries'):
            self._run_task('Generate daily summaries', self._generate_summaries)

        self.stdout.write(self.style.SUCCESS('\n✅ All tasks completed.'))

    def _run_task(self, name, func):
        self.stdout.write(f'\n▶ {name}...')
        try:
            result = func()
            self.stdout.write(self.style.SUCCESS(f'  ✓ {result}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Error: {e}'))
            logger.error(f'Task "{name}" failed: {e}', exc_info=True)

    def _fetch_brands(self):
        from apps.data_connectors.tasks import fetch_all_brand_data
        return fetch_all_brand_data()

    def _process_posts(self):
        from apps.nlp_engine.tasks import process_pending_posts
        return process_pending_posts()

    def _update_analytics(self):
        from apps.analytics.tasks import update_all_aggregations
        # Run synchronously — call sub-tasks directly
        from apps.brands.models import Brand
        from apps.analytics.tasks import update_brand_daily_analytics
        brands = Brand.objects.filter(status='active')
        for brand in brands:
            try:
                update_brand_daily_analytics(brand.id)
            except Exception as e:
                logger.error(f'Analytics error for brand {brand.id}: {e}')
        return f'Updated analytics for {brands.count()} brands'

    def _check_alerts(self):
        from apps.analytics.tasks import check_alert_thresholds
        return check_alert_thresholds()

    def _generate_summaries(self):
        from apps.nlp_engine.tasks import generate_brand_summary
        from apps.brands.models import Brand
        brands = Brand.objects.filter(status='active')
        for brand in brands:
            try:
                generate_brand_summary(brand.id, days=1)
            except Exception as e:
                logger.error(f'Summary error for brand {brand.id}: {e}')
        return f'Generated summaries for {brands.count()} brands'
