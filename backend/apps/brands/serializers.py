"""
Serializers for Brand Management
"""
from rest_framework import serializers
from .models import Brand, SocialPost, PostComment, BrandAlert, FetchLog


class BrandSerializer(serializers.ModelSerializer):
    """Serializer for Brand model"""
    
    posts_count = serializers.SerializerMethodField()
    competitor_name = serializers.SerializerMethodField()
    sentiment_distribution = serializers.SerializerMethodField()
    
    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'description', 'logo', 'website', 'industry',
            'keywords', 'hashtags', 'excluded_keywords', 'competitor', 'competitor_name',
            'platforms', 'status', 'fetch_frequency', 'last_fetch',
            'alert_enabled', 'alert_threshold', 'alert_email',
            'total_posts', 'avg_sentiment', 'posts_count', 'sentiment_distribution',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_posts', 'avg_sentiment', 'last_fetch', 'created_at', 'updated_at']
    
    def get_posts_count(self, obj):
        # Return total_posts from model (excludes spam) or count non-spam posts
        if obj.total_posts > 0:
            return obj.total_posts
        return obj.posts.filter(is_spam=False).count()
    
    def get_competitor_name(self, obj):
        return obj.competitor.name if obj.competitor else None
    
    def get_sentiment_distribution(self, obj):
        # Use processed, non-spam posts for sentiment distribution
        posts = obj.posts.filter(is_processed=True, is_spam=False)
        total = posts.count()
        if total == 0:
            return {'positive': 0, 'neutral': 0, 'negative': 0}
        
        return {
            'positive': round(posts.filter(sentiment='positive').count() / total, 4),
            'neutral': round(posts.filter(sentiment='neutral').count() / total, 4),
            'negative': round(posts.filter(sentiment='negative').count() / total, 4),
        }


class BrandCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating brands"""
    
    class Meta:
        model = Brand
        fields = [
            'name', 'description', 'logo', 'website', 'industry',
            'keywords', 'hashtags', 'excluded_keywords', 'competitor',
            'platforms', 'alert_enabled', 'alert_threshold', 'alert_email'
        ]
    
    def validate(self, attrs):
        user = self.context['request'].user
        
        # Check brand limit (company-scoped)
        if user.company_ref_id:
            current_count = Brand.objects.filter(company=user.company_ref).count()
            limits = user.company_ref.get_plan_limits()
            max_allowed = limits['max_brands']
        else:
            current_count = Brand.objects.filter(user=user).count()
            max_allowed = user.get_max_brands()
        
        if current_count >= max_allowed:
            raise serializers.ValidationError(
                f"You have reached your brand limit ({max_allowed}). "
                f"Upgrade your subscription to add more brands."
            )
        
        return attrs
    
    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        # company is set via perform_create in the view
        return super().create(validated_data)


class SocialPostSerializer(serializers.ModelSerializer):
    """Serializer for Social Posts"""
    
    engagement_score = serializers.ReadOnlyField()
    
    class Meta:
        model = SocialPost
        fields = [
            'id', 'brand', 'platform', 'platform_id', 'url',
            'author_id', 'author_name', 'author_username', 'author_followers', 'author_verified',
            'content', 'content_cleaned', 'language', 'has_media', 'media_urls',
            'likes', 'shares', 'comments', 'views', 'engagement_score',
            'sentiment', 'sentiment_score', 'sentiment_confidence',
            'emotions', 'topics', 'aspects', 'entities',
            'is_processed', 'is_spam', 'posted_at', 'fetched_at', 'processed_at'
        ]


class SocialPostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for post lists"""
    
    engagement_score = serializers.ReadOnlyField()
    
    class Meta:
        model = SocialPost
        fields = [
            'id', 'platform', 'url', 'author_name', 'author_username', 'author_verified',
            'content', 'likes', 'shares', 'comments', 'views', 'engagement_score',
            'sentiment', 'sentiment_score', 'emotions', 'posted_at'
        ]


class PostCommentSerializer(serializers.ModelSerializer):
    """Serializer for Post Comments"""
    
    class Meta:
        model = PostComment
        fields = [
            'id', 'post', 'platform_id', 'author_id', 'author_name',
            'content', 'sentiment', 'sentiment_score', 'likes', 'posted_at'
        ]


class BrandAlertSerializer(serializers.ModelSerializer):
    """Serializer for Brand Alerts"""
    
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    
    class Meta:
        model = BrandAlert
        fields = [
            'id', 'brand', 'brand_name', 'alert_type', 'severity',
            'title', 'description', 'metrics',
            'is_acknowledged', 'acknowledged_at',
            'is_resolved', 'resolution_notes', 'resolved_at',
            'created_at'
        ]
        read_only_fields = ['id', 'brand', 'alert_type', 'severity', 'title', 'description', 'metrics', 'created_at']


class FetchLogSerializer(serializers.ModelSerializer):
    """Serializer for Fetch Logs"""
    
    class Meta:
        model = FetchLog
        fields = [
            'id', 'brand', 'platform', 'status',
            'posts_fetched', 'posts_new', 'posts_duplicate',
            'error_message', 'metadata', 'started_at', 'completed_at'
        ]


class BrandComparisonSerializer(serializers.Serializer):
    """Serializer for brand comparison data"""
    
    brand_a = BrandSerializer()
    brand_b = BrandSerializer()
    comparison_data = serializers.DictField()

