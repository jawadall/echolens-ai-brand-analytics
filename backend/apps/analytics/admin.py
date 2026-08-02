"""
Admin configuration for analytics app
"""
from django.contrib import admin
from .models import DailyAnalytics, HourlyAnalytics, TopicTrend, SentimentSummary, PlatformAnalytics


@admin.register(DailyAnalytics)
class DailyAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['brand', 'date', 'total_posts', 'positive_ratio', 'neutral_ratio', 'negative_ratio', 'avg_sentiment_score']
    list_filter = ['brand', 'date']
    date_hierarchy = 'date'


@admin.register(HourlyAnalytics)
class HourlyAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['brand', 'datetime', 'total_posts', 'positive_count', 'negative_count']
    list_filter = ['brand', 'datetime']


@admin.register(TopicTrend)
class TopicTrendAdmin(admin.ModelAdmin):
    list_display = ['brand', 'topic', 'date', 'mention_count', 'sentiment_score']
    list_filter = ['brand', 'date']
    search_fields = ['topic']


@admin.register(SentimentSummary)
class SentimentSummaryAdmin(admin.ModelAdmin):
    list_display = ['brand', 'summary_type', 'start_date', 'end_date', 'created_at']
    list_filter = ['brand', 'summary_type', 'created_at']


@admin.register(PlatformAnalytics)
class PlatformAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['brand', 'platform', 'date', 'total_posts', 'avg_sentiment']
    list_filter = ['brand', 'platform', 'date']

