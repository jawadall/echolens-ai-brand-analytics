"""
Unit Tests for Exports App
Tests for CSV, Excel, and PDF export generators
"""
from django.test import TestCase
from django.utils import timezone
from datetime import datetime

from .generators import CSVGenerator, PDFGenerator


class CSVGeneratorTests(TestCase):
    """Tests for CSV export generation"""

    def test_generate_posts_csv(self):
        posts = [
            {
                'id': 1, 'platform': 'twitter',
                'author_name': 'Test User', 'author_username': 'testuser',
                'content': 'Great product!', 'sentiment': 'positive',
                'sentiment_score': 0.8, 'likes': 10, 'shares': 5,
                'comments': 2, 'views': 100, 'topics': ['quality', 'service'],
                'posted_at': timezone.now().isoformat(), 'url': 'http://example.com',
            },
            {
                'id': 2, 'platform': 'reddit',
                'author_name': 'Another', 'author_username': 'another',
                'content': 'Terrible service!', 'sentiment': 'negative',
                'sentiment_score': -0.6, 'likes': 3, 'shares': 1,
                'comments': 5, 'views': 50, 'topics': ['service'],
                'posted_at': timezone.now().isoformat(), 'url': 'http://reddit.com/1',
            },
        ]
        csv_content = CSVGenerator.generate_posts_csv(posts)
        self.assertIn('id,platform,author_name', csv_content)
        self.assertIn('twitter', csv_content)
        self.assertIn('reddit', csv_content)
        self.assertIn('Great product!', csv_content)

    def test_generate_posts_csv_empty(self):
        csv_content = CSVGenerator.generate_posts_csv([])
        self.assertIn('id,platform,author_name', csv_content)
        lines = csv_content.strip().split('\n')
        self.assertEqual(len(lines), 1)  # Header only

    def test_generate_analytics_csv(self):
        analytics_data = {
            'total_posts': 150,
            'positive': 90,
            'neutral': 40,
            'negative': 20,
            'avg_sentiment': 0.35,
        }
        csv_content = CSVGenerator.generate_analytics_csv(analytics_data)
        self.assertIn('Echo Lens Analytics Report', csv_content)
        self.assertIn('150', csv_content)

    def test_generate_analytics_csv_with_daily(self):
        analytics_data = {
            'total_posts': 10,
            'positive': 5,
            'neutral': 3,
            'negative': 2,
            'avg_sentiment': 0.2,
            'daily_data': [
                {'date': '2026-01-01', 'total': 5, 'positive': 3,
                 'neutral': 1, 'negative': 1, 'avg_sentiment': 0.3},
            ],
        }
        csv_content = CSVGenerator.generate_analytics_csv(analytics_data)
        self.assertIn('Daily Breakdown', csv_content)


class PDFGeneratorTests(TestCase):
    """Tests for PDF export generation"""

    def test_generate_summary_pdf(self):
        analytics_data = {
            'total_posts': 100,
            'positive': 60, 'neutral': 25, 'negative': 15,
            'positive_pct': 60.0, 'neutral_pct': 25.0, 'negative_pct': 15.0,
            'avg_sentiment': 0.42,
            'top_topics': [
                {'topic': 'quality', 'count': 25},
                {'topic': 'service', 'count': 18},
            ],
        }
        summary_data = {
            'summary': 'Overall positive brand perception.',
            'key_insights': ['Users love quality', 'Service is praised'],
            'what_users_like': 'Product quality',
            'what_users_dislike': 'High pricing',
            'recommendations': ['Consider discounts'],
        }
        result = PDFGenerator.generate_summary_pdf('TestBrand', analytics_data, summary_data)
        self.assertIsInstance(result, bytes)
        self.assertGreater(len(result), 0)

    def test_generate_pdf_without_summary(self):
        analytics_data = {
            'total_posts': 50,
            'positive': 30, 'neutral': 15, 'negative': 5,
            'positive_pct': 60.0, 'neutral_pct': 30.0, 'negative_pct': 10.0,
            'avg_sentiment': 0.38,
        }
        result = PDFGenerator.generate_summary_pdf('NoBrand', analytics_data)
        self.assertIsInstance(result, bytes)
