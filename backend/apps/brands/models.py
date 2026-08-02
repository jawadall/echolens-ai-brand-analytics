"""
Brand Models for Echo Lens
Core models for brand monitoring, posts, and sentiment data
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


class Brand(models.Model):
    """Brand being monitored"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('archived', 'Archived'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='brands',
        help_text='User who created this brand'
    )
    company = models.ForeignKey(
        'admin_dashboard.Company', verbose_name='Business',
        null=True, blank=True, on_delete=models.CASCADE,
        related_name='brands',
        help_text='Business this brand belongs to — all business members can access'
    )
    name = models.CharField('Brand Name', max_length=200)
    description = models.TextField('Description', blank=True)
    logo = models.ImageField('Logo', upload_to='brand_logos/', null=True, blank=True)
    website = models.URLField('Website', blank=True)
    industry = models.CharField('Industry', max_length=100, blank=True)
    
    # Keywords for monitoring
    keywords = models.JSONField('Keywords', default=list, help_text='List of keywords to track')
    hashtags = models.JSONField('Hashtags', default=list, help_text='List of hashtags to track')
    excluded_keywords = models.JSONField('Excluded Keywords', default=list, help_text='Keywords to exclude')
    
    # Competitor tracking
    competitor = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='competitors',
        help_text='Competitor brand for comparison'
    )
    
    # Data source settings
    platforms = models.JSONField(
        'Platforms',
        default=list,
        help_text='List of platforms to monitor: twitter, reddit, etc.'
    )
    
    # Monitoring settings
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='active')
    fetch_frequency = models.PositiveIntegerField('Fetch Frequency (minutes)', default=60)
    last_fetch = models.DateTimeField('Last Data Fetch', null=True, blank=True)
    
    # Alert settings
    alert_enabled = models.BooleanField('Alerts Enabled', default=True)
    alert_threshold = models.FloatField(
        'Negative Sentiment Alert Threshold',
        default=0.3,
        help_text='Alert when negative sentiment exceeds this percentage (0-1)'
    )
    alert_email = models.EmailField('Alert Email', blank=True)
    
    # Per-brand API keys (overrides global .env keys when set)
    api_keys = models.JSONField(
        'API Keys',
        default=dict,
        blank=True,
        help_text='Per-brand API keys: youtube_api_key, twitter_bearer_token, reddit_client_id, reddit_client_secret, facebook_access_token, news_api_key'
    )
    
    # Statistics (cached)
    total_posts = models.PositiveIntegerField('Total Posts', default=0)
    avg_sentiment = models.FloatField('Average Sentiment', default=0.0)
    
    # Timestamps
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    updated_at = models.DateTimeField('Updated At', auto_now=True)
    
    class Meta:
        verbose_name = 'Brand'
        verbose_name_plural = 'Brands'
        ordering = ['-created_at']
        unique_together = ['company', 'name']
    
    def __str__(self):
        return self.name
    
    def get_all_keywords(self):
        """Get all keywords including brand name"""
        all_keywords = [self.name.lower()]
        all_keywords.extend([k.lower() for k in self.keywords])
        return list(set(all_keywords))
    
    def get_all_hashtags(self):
        """Get all hashtags with # prefix"""
        return [h if h.startswith('#') else f'#{h}' for h in self.hashtags]
    
    def update_fetch_time(self):
        """Update last fetch timestamp"""
        self.last_fetch = timezone.now()
        self.save(update_fields=['last_fetch'])
    
    def update_stats(self):
        """Update brand statistics from posts"""
        from django.db.models import Avg
        
        # Count all non-spam posts
        non_spam = self.posts.filter(is_spam=False)
        self.total_posts = non_spam.count()
        
        # Calculate average sentiment from processed posts
        processed_posts = non_spam.filter(is_processed=True)
        if processed_posts.exists():
            self.avg_sentiment = processed_posts.aggregate(avg=Avg('sentiment_score'))['avg'] or 0.0
        else:
            self.avg_sentiment = 0.0
        
        self.save(update_fields=['total_posts', 'avg_sentiment'])


class SocialPost(models.Model):
    """Social media posts collected for brands"""
    
    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('reddit', 'Reddit'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('youtube', 'YouTube'),
        ('news', 'News Article'),
        ('other', 'Other'),
    ]
    
    SENTIMENT_CHOICES = [
        ('positive', 'Positive'),
        ('neutral', 'Neutral'),
        ('negative', 'Negative'),
    ]
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='posts')
    
    # Post identifiers
    platform = models.CharField('Platform', max_length=20, choices=PLATFORM_CHOICES)
    platform_id = models.CharField('Platform ID', max_length=200)
    url = models.URLField('Post URL', max_length=500, blank=True)
    
    # Author info
    author_id = models.CharField('Author ID', max_length=200, blank=True)
    author_name = models.CharField('Author Name', max_length=200, blank=True)
    author_username = models.CharField('Author Username', max_length=200, blank=True)
    author_followers = models.PositiveIntegerField('Author Followers', default=0)
    author_verified = models.BooleanField('Author Verified', default=False)
    
    # Content
    content = models.TextField('Content')
    content_cleaned = models.TextField('Cleaned Content', blank=True)
    language = models.CharField('Language', max_length=10, default='en')
    
    # Media
    has_media = models.BooleanField('Has Media', default=False)
    media_urls = models.JSONField('Media URLs', default=list)
    
    # Engagement metrics
    likes = models.PositiveIntegerField('Likes', default=0)
    shares = models.PositiveIntegerField('Shares/Retweets', default=0)
    comments = models.PositiveIntegerField('Comments/Replies', default=0)
    views = models.PositiveIntegerField('Views', default=0)
    
    # NLP Analysis Results
    sentiment = models.CharField('Sentiment', max_length=20, choices=SENTIMENT_CHOICES, null=True, blank=True)
    sentiment_score = models.FloatField('Sentiment Score', null=True, blank=True, help_text='-1 to 1')
    sentiment_confidence = models.FloatField('Sentiment Confidence', null=True, blank=True)
    
    # Emotions (joy, anger, fear, sadness, surprise, etc.)
    emotions = models.JSONField('Emotions', default=dict, blank=True)
    
    # Topics and aspects
    topics = models.JSONField('Topics', default=list, blank=True)
    aspects = models.JSONField('Aspects', default=dict, blank=True)
    entities = models.JSONField('Named Entities', default=list, blank=True)
    
    # Processing status
    is_processed = models.BooleanField('Is Processed', default=False)
    is_spam = models.BooleanField('Is Spam', default=False)
    
    # Timestamps
    posted_at = models.DateTimeField('Posted At')
    fetched_at = models.DateTimeField('Fetched At', auto_now_add=True)
    processed_at = models.DateTimeField('Processed At', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Social Post'
        verbose_name_plural = 'Social Posts'
        ordering = ['-posted_at']
        unique_together = ['brand', 'platform', 'platform_id']
        indexes = [
            models.Index(fields=['brand', 'posted_at']),
            models.Index(fields=['brand', 'sentiment']),
            models.Index(fields=['brand', 'platform']),
            models.Index(fields=['is_processed']),
        ]
    
    def __str__(self):
        return f"{self.platform} - {self.content[:50]}..."
    
    @property
    def engagement_score(self):
        """Calculate engagement score"""
        return self.likes + (self.shares * 2) + (self.comments * 3)


class PostComment(models.Model):
    """Comments on social posts"""
    
    post = models.ForeignKey(SocialPost, on_delete=models.CASCADE, related_name='post_comments')
    platform_id = models.CharField('Comment ID', max_length=200)
    
    author_id = models.CharField('Author ID', max_length=200, blank=True)
    author_name = models.CharField('Author Name', max_length=200, blank=True)
    
    content = models.TextField('Content')
    content_cleaned = models.TextField('Cleaned Content', blank=True)
    
    # NLP Results
    sentiment = models.CharField('Sentiment', max_length=20, null=True, blank=True)
    sentiment_score = models.FloatField('Sentiment Score', null=True, blank=True)
    
    # Engagement
    likes = models.PositiveIntegerField('Likes', default=0)
    
    # Timestamps
    posted_at = models.DateTimeField('Posted At')
    fetched_at = models.DateTimeField('Fetched At', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Post Comment'
        verbose_name_plural = 'Post Comments'
        ordering = ['-posted_at']
        unique_together = ['post', 'platform_id']


class BrandAlert(models.Model):
    """Alerts for brand monitoring"""
    
    ALERT_TYPES = [
        ('negative_spike', 'Negative Sentiment Spike'),
        ('volume_spike', 'Volume Spike'),
        ('trending', 'Trending Topic'),
        ('influencer', 'Influencer Mention'),
        ('crisis', 'Potential Crisis'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField('Alert Type', max_length=50, choices=ALERT_TYPES)
    severity = models.CharField('Severity', max_length=20, choices=SEVERITY_CHOICES, default='medium')
    
    title = models.CharField('Title', max_length=200)
    description = models.TextField('Description')
    
    # Related data
    related_posts = models.ManyToManyField(SocialPost, blank=True, related_name='alerts')
    metrics = models.JSONField('Metrics', default=dict, blank=True)
    
    # Status
    is_acknowledged = models.BooleanField('Acknowledged', default=False)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_alerts'
    )
    acknowledged_at = models.DateTimeField('Acknowledged At', null=True, blank=True)
    
    # Resolution
    is_resolved = models.BooleanField('Resolved', default=False)
    resolution_notes = models.TextField('Resolution Notes', blank=True)
    resolved_at = models.DateTimeField('Resolved At', null=True, blank=True)
    
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Brand Alert'
        verbose_name_plural = 'Brand Alerts'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.brand.name} - {self.title}"


class FetchLog(models.Model):
    """Log of data fetch operations"""
    
    STATUS_CHOICES = [
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('partial', 'Partial Success'),
    ]
    
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='fetch_logs')
    platform = models.CharField('Platform', max_length=50)
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES)
    
    posts_fetched = models.PositiveIntegerField('Posts Fetched', default=0)
    posts_new = models.PositiveIntegerField('New Posts', default=0)
    posts_duplicate = models.PositiveIntegerField('Duplicate Posts', default=0)
    
    error_message = models.TextField('Error Message', blank=True)
    metadata = models.JSONField('Metadata', default=dict, blank=True)
    
    started_at = models.DateTimeField('Started At', auto_now_add=True)
    completed_at = models.DateTimeField('Completed At', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Fetch Log'
        verbose_name_plural = 'Fetch Logs'
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.brand.name} - {self.platform} - {self.status}"

