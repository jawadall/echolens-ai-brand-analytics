"""
Admin configuration for brands app
"""
from django.contrib import admin
from .models import Brand, SocialPost, PostComment, BrandAlert, FetchLog


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'status', 'total_posts', 'avg_sentiment', 'last_fetch', 'created_at']
    list_filter = ['status', 'platforms', 'industry', 'created_at']
    search_fields = ['name', 'description', 'user__email']
    readonly_fields = ['total_posts', 'avg_sentiment', 'last_fetch', 'created_at', 'updated_at']
    
    fieldsets = (
        (None, {'fields': ('user', 'name', 'description', 'logo', 'website', 'industry')}),
        ('Keywords', {'fields': ('keywords', 'hashtags', 'excluded_keywords')}),
        ('Monitoring', {'fields': ('competitor', 'platforms', 'status', 'fetch_frequency')}),
        ('Alerts', {'fields': ('alert_enabled', 'alert_threshold', 'alert_email')}),
        ('Statistics', {'fields': ('total_posts', 'avg_sentiment', 'last_fetch')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = ['get_short_content', 'brand', 'platform', 'sentiment', 'likes', 'posted_at', 'is_processed']
    list_filter = ['platform', 'sentiment', 'is_processed', 'is_spam', 'posted_at']
    search_fields = ['content', 'author_name', 'author_username', 'brand__name']
    readonly_fields = ['fetched_at', 'processed_at']
    date_hierarchy = 'posted_at'
    
    def get_short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    get_short_content.short_description = 'Content'


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    list_display = ['get_short_content', 'post', 'author_name', 'sentiment', 'posted_at']
    list_filter = ['sentiment', 'posted_at']
    search_fields = ['content', 'author_name']
    
    def get_short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    get_short_content.short_description = 'Content'


@admin.register(BrandAlert)
class BrandAlertAdmin(admin.ModelAdmin):
    list_display = ['brand', 'alert_type', 'severity', 'is_acknowledged', 'is_resolved', 'created_at']
    list_filter = ['alert_type', 'severity', 'is_acknowledged', 'is_resolved', 'created_at']
    search_fields = ['brand__name', 'title', 'description']


@admin.register(FetchLog)
class FetchLogAdmin(admin.ModelAdmin):
    list_display = ['brand', 'platform', 'status', 'posts_fetched', 'posts_new', 'started_at']
    list_filter = ['platform', 'status', 'started_at']
    search_fields = ['brand__name']

