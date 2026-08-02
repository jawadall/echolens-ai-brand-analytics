"""
Unit Tests for Analytics App
Tests for analytics views and aggregation
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from apps.brands.models import Brand, SocialPost
from .models import DailyAnalytics, SentimentSummary

User = get_user_model()


class AnalyticsModelTests(TestCase):
    """Tests for analytics models"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='analytics@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        self.brand = Brand.objects.create(
            user=self.user, name='AnalyticsBrand', platforms=['twitter']
        )

    def test_daily_analytics_creation(self):
        daily = DailyAnalytics.objects.create(
            brand=self.brand,
            date=timezone.now().date(),
            total_posts=100,
            positive_count=60,
            neutral_count=30,
            negative_count=10,
            avg_sentiment=0.45,
        )
        self.assertEqual(str(daily), f'AnalyticsBrand - {timezone.now().date()}')

    def test_sentiment_summary_creation(self):
        summary = SentimentSummary.objects.create(
            brand=self.brand,
            summary_type='weekly',
            start_date=timezone.now() - timedelta(days=7),
            end_date=timezone.now(),
            summary_text='Overall positive sentiment.',
            key_insights=['Users love the product'],
            what_users_like='Quality and service',
            what_users_dislike='Pricing',
            recommendations=['Consider loyalty discounts'],
        )
        self.assertIn('positive', summary.summary_text)


class AnalyticsAPITests(APITestCase):
    """Tests for analytics API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='apitest@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        self.client.force_authenticate(user=self.user)
        self.brand = Brand.objects.create(
            user=self.user, name='APBrand', platforms=['twitter']
        )
        # Create some posts
        for i in range(5):
            SocialPost.objects.create(
                brand=self.brand, platform='twitter',
                platform_id=f'tw_an_{i}',
                content=f'Test post {i}',
                sentiment='positive' if i < 3 else 'negative',
                sentiment_score=0.8 if i < 3 else -0.5,
                is_processed=True,
                posted_at=timezone.now() - timedelta(hours=i),
            )

    def test_brand_overview(self):
        response = self.client.get(
            reverse('analytics:brand_overview', kwargs={'pk': self.brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_posts'], 5)

    def test_brand_trends(self):
        response = self.client.get(
            reverse('analytics:sentiment_trends', kwargs={'pk': self.brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('labels', response.data)

    def test_platform_breakdown(self):
        response = self.client.get(
            reverse('analytics:platform_breakdown', kwargs={'pk': self.brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_top_posts(self):
        response = self.client.get(
            reverse('analytics:top_posts', kwargs={'pk': self.brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_overview_with_days_filter(self):
        response = self.client.get(
            reverse('analytics:brand_overview', kwargs={'pk': self.brand.id}),
            {'days': 7}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
