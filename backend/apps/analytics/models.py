"""
Analytics Models for Echo Lens
Aggregated data and time-series analytics
"""
from django.db import models
from apps.brands.models import Brand


class DailyAnalytics(models.Model):
    """Daily aggregated analytics for a brand"""
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='daily_analytics')
    date = models.DateField('Date')
    
    # Volume metrics
    total_posts = models.PositiveIntegerField('Total Posts', default=0)
    posts_by_platform = models.JSONField('Posts by Platform', default=dict)
    
    # Sentiment metrics
    positive_count = models.PositiveIntegerField('Positive Posts', default=0)
    neutral_count = models.PositiveIntegerField('Neutral Posts', default=0)
    negative_count = models.PositiveIntegerField('Negative Posts', default=0)
    avg_sentiment_score = models.FloatField('Average Sentiment Score', default=0.0)
    
    # Sentiment percentages
    positive_ratio = models.FloatField('Positive Ratio', default=0.0)
    neutral_ratio = models.FloatField('Neutral Ratio', default=0.0)
    negative_ratio = models.FloatField('Negative Ratio', default=0.0)
    
    # Engagement metrics
    total_likes = models.PositiveIntegerField('Total Likes', default=0)
    total_shares = models.PositiveIntegerField('Total Shares', default=0)
    total_comments = models.PositiveIntegerField('Total Comments', default=0)
    total_views = models.PositiveIntegerField('Total Views', default=0)
    avg_engagement = models.FloatField('Average Engagement', default=0.0)
    
    # Topics and emotions
    top_topics = models.JSONField('Top Topics', default=list)
    emotions_distribution = models.JSONField('Emotions Distribution', default=dict)
    
    # Influencers
    top_authors = models.JSONField('Top Authors', default=list)
    
    # Timestamps
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    updated_at = models.DateTimeField('Updated At', auto_now=True)
    
    class Meta:
        verbose_name = 'Daily Analytics'
        verbose_name_plural = 'Daily Analytics'
        unique_together = ['brand', 'date']
        ordering = ['-date']
        indexes = [
            models.Index(fields=['brand', 'date']),
        ]
    
    def __str__(self):
        return f"{self.brand.name} - {self.date}"


class HourlyAnalytics(models.Model):
    """Hourly aggregated analytics for real-time monitoring"""
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='hourly_analytics')
    datetime = models.DateTimeField('Date Time')
    
    total_posts = models.PositiveIntegerField('Total Posts', default=0)
    positive_count = models.PositiveIntegerField('Positive Posts', default=0)
    neutral_count = models.PositiveIntegerField('Neutral Posts', default=0)
    negative_count = models.PositiveIntegerField('Negative Posts', default=0)
    avg_sentiment_score = models.FloatField('Average Sentiment Score', default=0.0)
    
    class Meta:
        verbose_name = 'Hourly Analytics'
        verbose_name_plural = 'Hourly Analytics'
        unique_together = ['brand', 'datetime']
        ordering = ['-datetime']
    
    def __str__(self):
        return f"{self.brand.name} - {self.datetime}"


class TopicTrend(models.Model):
    """Trending topics over time"""
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='topic_trends')
    topic = models.CharField('Topic', max_length=200)
    date = models.DateField('Date')
    
    mention_count = models.PositiveIntegerField('Mention Count', default=0)
    sentiment_score = models.FloatField('Average Sentiment', default=0.0)
    
    # Related posts sample
    sample_posts = models.JSONField('Sample Post IDs', default=list)
    
    class Meta:
        verbose_name = 'Topic Trend'
        verbose_name_plural = 'Topic Trends'
        unique_together = ['brand', 'topic', 'date']
        ordering = ['-date', '-mention_count']
    
    def __str__(self):
        return f"{self.brand.name} - {self.topic} - {self.date}"


class SentimentSummary(models.Model):
    """AI-generated sentiment summaries"""
    
    SUMMARY_TYPES = [
        ('daily', 'Daily Summary'),
        ('weekly', 'Weekly Summary'),
        ('monthly', 'Monthly Summary'),
        ('custom', 'Custom Period'),
    ]
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='sentiment_summaries')
    summary_type = models.CharField('Summary Type', max_length=20, choices=SUMMARY_TYPES)
    
    start_date = models.DateField('Start Date')
    end_date = models.DateField('End Date')
    
    # AI-generated content
    summary_text = models.TextField('Summary Text')
    key_insights = models.JSONField('Key Insights', default=list)
    what_users_like = models.TextField('What Users Like', blank=True)
    what_users_dislike = models.TextField('What Users Dislike', blank=True)
    platform_analysis = models.TextField('Platform Analysis', blank=True)
    recommendations = models.JSONField('Recommendations', default=list)
    
    # Metrics snapshot
    metrics_snapshot = models.JSONField('Metrics Snapshot', default=dict)
    
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Sentiment Summary'
        verbose_name_plural = 'Sentiment Summaries'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.brand.name} - {self.summary_type} - {self.start_date}"


class PlatformAnalytics(models.Model):
    """Platform-specific analytics"""
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='platform_analytics')
    platform = models.CharField('Platform', max_length=50)
    date = models.DateField('Date')
    
    total_posts = models.PositiveIntegerField('Total Posts', default=0)
    avg_sentiment = models.FloatField('Average Sentiment', default=0.0)
    avg_engagement = models.FloatField('Average Engagement', default=0.0)
    
    top_posts = models.JSONField('Top Post IDs', default=list)
    
    class Meta:
        verbose_name = 'Platform Analytics'
        verbose_name_plural = 'Platform Analytics'
        unique_together = ['brand', 'platform', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.brand.name} - {self.platform} - {self.date}"

