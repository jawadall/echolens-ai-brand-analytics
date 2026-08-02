"""
Serializers for Analytics
"""
from rest_framework import serializers
from .models import DailyAnalytics, HourlyAnalytics, TopicTrend, SentimentSummary, PlatformAnalytics


class DailyAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for daily analytics"""
    
    class Meta:
        model = DailyAnalytics
        fields = [
            'id', 'brand', 'date',
            'total_posts', 'posts_by_platform',
            'positive_count', 'neutral_count', 'negative_count', 'avg_sentiment_score',
            'positive_ratio', 'neutral_ratio', 'negative_ratio',
            'total_likes', 'total_shares', 'total_comments', 'total_views', 'avg_engagement',
            'top_topics', 'emotions_distribution', 'top_authors'
        ]


class HourlyAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for hourly analytics"""
    
    class Meta:
        model = HourlyAnalytics
        fields = [
            'id', 'brand', 'datetime',
            'total_posts', 'positive_count', 'neutral_count', 'negative_count', 'avg_sentiment_score'
        ]


class TopicTrendSerializer(serializers.ModelSerializer):
    """Serializer for topic trends"""
    
    class Meta:
        model = TopicTrend
        fields = ['id', 'brand', 'topic', 'date', 'mention_count', 'sentiment_score', 'sample_posts']


class SentimentSummarySerializer(serializers.ModelSerializer):
    """Serializer for AI-generated summaries"""
    
    class Meta:
        model = SentimentSummary
        fields = [
            'id', 'brand', 'summary_type', 'start_date', 'end_date',
            'summary_text', 'key_insights', 'what_users_like', 'what_users_dislike',
            'platform_analysis', 'recommendations', 'metrics_snapshot', 'created_at'
        ]


class PlatformAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for platform analytics"""
    
    class Meta:
        model = PlatformAnalytics
        fields = ['id', 'brand', 'platform', 'date', 'total_posts', 'avg_sentiment', 'avg_engagement', 'top_posts']


class OverviewStatsSerializer(serializers.Serializer):
    """Serializer for overview statistics"""
    
    total_posts = serializers.IntegerField()
    total_positive = serializers.IntegerField()
    total_neutral = serializers.IntegerField()
    total_negative = serializers.IntegerField()
    sentiment_score = serializers.FloatField()
    total_engagement = serializers.IntegerField()
    trending_topics = serializers.ListField()
    recent_alerts = serializers.IntegerField()


class TrendDataSerializer(serializers.Serializer):
    """Serializer for trend data"""
    
    labels = serializers.ListField(child=serializers.CharField())
    datasets = serializers.ListField()


class WordCloudDataSerializer(serializers.Serializer):
    """Serializer for word cloud data"""
    
    text = serializers.CharField()
    value = serializers.IntegerField()
    sentiment = serializers.CharField(required=False)

